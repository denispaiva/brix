/**
 * Extrae {owner, repo} de una URL de github.com. Devuelve null si la URL no tiene
 * esa forma — nunca lanza, porque "esta URL no es de GitHub" es una condición
 * esperada y normal (el candidato puede estar en GitLab, o no tener repo público
 * en absoluto), no un error de programación.
 */
export function parseGithubUrl(url) {
  const match = /^https?:\/\/github\.com\/([^/\s?#]+)\/([^/\s?#]+?)(?:\.git)?\/?(?:[?#].*)?$/.exec(url.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

const GITHUB_API_BASE = "https://api.github.com";

function buildHeaders(token) {
  const headers = { "User-Agent": "blends-tooling-scoring", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Metadata cruda de un repositorio de GitHub. No calcula ningún score — eso es
 * trabajo del motor de scoring (Etapa 1) o del juicio del modelo (Etapa 3); esta
 * función solo obtiene y normaliza el hecho observado, con su estado.
 */
export async function fetchGithubRepository(owner, repo, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const headers = buildHeaders(token);

  let response;
  try {
    response = await fetchImpl(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers });
  } catch (error) {
    return { state: "unavailable", error: error.message };
  }

  if (response.status === 404) return { state: "not_found" };
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    return { state: "rate_limited", resetAt: response.headers.get("x-ratelimit-reset") };
  }
  if (!response.ok) return { state: "unavailable", httpStatus: response.status };

  let body;
  try {
    body = await response.json();
  } catch (error) {
    return { state: "unavailable", error: error.message };
  }
  const expectedFullName = `${owner}/${repo}`;
  const conflicting = body.full_name != null && body.full_name.toLowerCase() !== expectedFullName.toLowerCase();

  const data = {
    fullName: body.full_name,
    stars: body.stargazers_count,
    forks: body.forks_count,
    openIssues: body.open_issues_count,
    createdAt: body.created_at,
    pushedAt: body.pushed_at,
    license: body.license?.spdx_id ?? null,
    archived: body.archived ?? false,
    defaultBranch: body.default_branch,
  };

  if (conflicting) {
    return { state: "conflicting", expectedFullName, actualFullName: body.full_name, data };
  }
  return { state: "available", data };
}

/**
 * Conteo de contribuidores vía el truco del header Link: pedir per_page=1 y leer
 * el número de página en rel="last" evita paginar todo el listado (poco confiable
 * y lento para repos grandes, según lo que ya se investigó para la auditoría de
 * este mismo sistema).
 */
export async function fetchGithubContributorsCount(owner, repo, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const headers = buildHeaders(token);

  let response;
  try {
    response = await fetchImpl(`${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=1&anon=true`, { headers });
  } catch (error) {
    return { state: "unavailable", error: error.message };
  }

  if (response.status === 404) return { state: "not_found" };
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    return { state: "rate_limited", resetAt: response.headers.get("x-ratelimit-reset") };
  }
  if (!response.ok) return { state: "unavailable", httpStatus: response.status };

  const linkHeader = response.headers.get("link");
  if (!linkHeader) {
    let body;
    try {
      body = await response.json();
    } catch (error) {
      return { state: "unavailable", error: error.message };
    }
    return { state: "available", data: { count: body.length } };
  }
  const lastPageMatch = /[?&]page=(\d+)>;\s*rel="last"/.exec(linkHeader);
  if (!lastPageMatch) return { state: "unavailable", note: "Link header presente sin rel=last reconocible" };
  return { state: "available", data: { count: Number(lastPageMatch[1]) } };
}

const PROPAGATED_STATES = new Set(["not_found", "unavailable", "rate_limited"]);

/**
 * Orquesta parseGithubUrl + fetchGithubRepository + fetchGithubContributorsCount
 * en la forma {counts: {stars, contributors, forks}} que computeCommunityScore
 * (vc/tools/lib/scoring-engine.mjs, Etapa 1) ya consume tal cual.
 */
export async function collectGithubCommunityEvidence(url, options = {}) {
  const parsed = parseGithubUrl(url);
  if (!parsed) return { state: "not_applicable", reason: "la URL no es de github.com" };
  const { owner, repo } = parsed;

  const repository = await fetchGithubRepository(owner, repo, options);
  if (PROPAGATED_STATES.has(repository.state)) return repository;

  const contributors = await fetchGithubContributorsCount(owner, repo, options);
  const clock = options.clock ?? (() => new Date().toISOString());

  return {
    state: repository.state, // "available" o "conflicting"
    ...(repository.state === "conflicting"
      ? { expectedFullName: repository.expectedFullName, actualFullName: repository.actualFullName }
      : {}),
    counts: {
      stars: repository.data.stars,
      forks: repository.data.forks,
      contributors: contributors.state === "available" ? contributors.data.count : null,
    },
    contributorsState: contributors.state,
    raw: repository.data,
    observedAt: clock(),
  };
}
