export function fakeDriverShape() {
  const caps = [
    'mint',
    'create_event',
    'join',
    'host_transition',
    'play',
    'capture',
    'reveal',
    'resolve_code',
    'read',
    'assert',
  ];
  return {
    targets: {
      emulator: { mode: 'autonomous' },
      'dev-x': { mode: 'conducted' },
    },
    capabilities: () => caps,
  };
}

export function minimalScenario() {
  return {
    schemaVersion: 2,
    id: 'minimal',
    title: 'Mínimo',
    driver: 'fake',
    targets: ['emulator', 'dev-x'],
    seed: 1,
    cleanup: 'manifest',
    event: {
      setup_mode: 'double_blind',
      participant_limit: 3,
      wine_count: 2,
      host_plays: false,
      round_seconds: 30,
      identifiers: ['1-espadas', '1-bastos'],
    },
    accounts: [
      {
        id: 'host',
        role: 'host_and_player',
        provider: 'google',
        standIn: { profile: 'steady' },
      },
    ],
    bots: [{ id: 'bots', kind: 'guest', count: 2, profile: 'mixed' }],
    steps: [
      {
        actor: 'host',
        op: 'manual',
        do: 'Crear el evento',
        captures: 'event_code',
        expect: 'Lobby',
        auto: { op: 'create_event', args: { $ref: 'event' } },
      },
      { actor: 'bots', op: 'join', expect: { participants: 3 } },
    ],
  };
}

export function fullScenario() {
  return {
    schemaVersion: 2,
    id: 'full-tasting',
    title: 'Degustación completa',
    driver: 'fake',
    targets: ['emulator', 'dev-x'],
    seed: 20261006,
    cleanup: 'manifest',
    event: {
      setup_mode: 'double_blind',
      participant_limit: 5,
      wine_count: 4,
      host_plays: true,
      round_seconds: 30,
      identifiers: ['1-espadas', '1-bastos', '1-oros', '1-copas'],
    },
    accounts: [
      {
        id: 'host',
        role: 'host_and_player',
        provider: 'google',
        standIn: { profile: 'steady' },
      },
      {
        id: 'registered_google',
        role: 'registered_player',
        provider: 'google',
        standIn: { profile: 'novice' },
      },
    ],
    bots: [
      {
        id: 'bots',
        kind: 'guest',
        count: 3,
        profile: 'mixed',
        joinAfter: ['registered_google'],
      },
    ],
    steps: [
      {
        actor: 'host',
        op: 'manual',
        do: 'Crear el evento',
        captures: 'event_code',
        expect: 'Lobby',
        auto: { op: 'create_event', args: { $ref: 'event' } },
      },
      {
        actor: 'registered_google',
        op: 'manual',
        do: 'Unirse con el código',
        expect: '2 en la sala',
        auto: { op: 'join' },
      },
      { actor: 'bots', op: 'join', expect: { participants: 5 } },
      {
        actor: 'host',
        op: 'manual',
        do: 'Arrancar la cata',
        expect: 'label_preview',
        auto: { op: 'host_transition', args: { action: 'start' } },
      },
      {
        repeat: {
          over: 'event.identifiers',
          as: 'identifier',
          steps: [
            {
              actor: 'host',
              op: 'manual',
              do: 'Abrir ronda con {identifier}',
              auto: {
                op: 'host_transition',
                args: { action: 'open_round', identifier: '{identifier}' },
              },
            },
            { actor: 'bots', op: 'play' },
            {
              actor: 'accounts',
              op: 'manual',
              do: 'Puntuar y votar a mano',
              auto: { op: 'play' },
            },
            {
              actor: 'host',
              op: 'manual',
              do: 'Cerrar la ronda',
              auto: { op: 'host_transition', args: { action: 'close_round' } },
            },
          ],
        },
      },
      {
        actor: 'host',
        op: 'manual',
        do: 'Terminar la rectificación',
        auto: { op: 'host_transition', args: { action: 'end_rectification' } },
      },
      {
        actor: 'host',
        op: 'manual',
        do: 'Cerrar el desvelo',
        auto: { op: 'host_transition', args: { action: 'resolve' } },
      },
      {
        actor: 'host',
        op: 'manual',
        do: 'Cerrar el evento',
        auto: { op: 'host_transition', args: { action: 'close' } },
      },
      {
        actor: 'runner',
        op: 'assert',
        expect: { 'event.status': 'closed', 'scores.count': 5 },
      },
    ],
  };
}
