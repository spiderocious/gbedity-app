// The exhaustive catalog of debug-log event names. Every `log.event(...)` call uses one of these —
// never a raw string — so the set stays greppable, mutable per-event, and self-documenting. Names
// are snake_case, verb-based, grouped by a domain prefix. Add new events here as the flow grows.
//
// Prefixes:
//   app_*     — app/router lifecycle
//   nav_*     — navigation between screens
//   api_*     — REST calls (request / response / error)
//   ws_*      — websocket connection + packets (sent / received)
//   room_*    — room lifecycle (join, lobby, end, closed)
//   lobby_*   — host lobby actions (queue, start, league)
//   config_*  — game configure screen
//   flow_*    — per-game flow component lifecycle + patch routing
//   stage_*   — the flow stage machine (intro → countdown → playing → …)
//   game_*    — in-game user actions (submit, skip)
//   ui_*      — generic component mount/unmount + notable UI events

export const LogEvent = {
  // ── app / nav ────────────────────────────────────────────────────────────
  APP_BOOTED: 'app_booted',
  NAV_TO: 'nav_to',
  NAV_STAGE_GO: 'nav_stage_go', // useStageNav.go() invoked (curtain begins)
  NAV_STAGE_NAVIGATE: 'nav_stage_navigate', // curtain midpoint → actual navigate()

  // ── REST ─────────────────────────────────────────────────────────────────
  API_REQUEST: 'api_request',
  API_RESPONSE: 'api_response',
  API_ERROR: 'api_error',

  // ── websocket ──────────────────────────────────────────────────────────────
  WS_CONNECTING: 'ws_connecting',
  WS_CONNECTED: 'ws_connected',
  WS_DISCONNECTED: 'ws_disconnected',
  WS_RECONNECT_ATTEMPT: 'ws_reconnect_attempt',
  WS_JOIN_SENT: 'ws_join_sent',
  WS_PACKET_SENT: 'ws_packet_sent', // client.action emitted
  WS_PACKET_RECEIVED: 'ws_packet_received', // any server.* event
  WS_VIEW_RECEIVED: 'ws_view_received', // server.view (parsed patch) — the hot path
  WS_VIEW_PARSE_FAILED: 'ws_view_parse_failed',
  WS_ERROR: 'ws_error',
  WS_TEARDOWN: 'ws_teardown', // provider effect cleanup (socket close)

  // ── room lifecycle ───────────────────────────────────────────────────────
  ROOM_JOINED: 'room_joined',
  ROOM_GAME_OVER: 'room_game_over',
  ROOM_SUSPENDED: 'room_suspended',
  ROOM_RESUMED: 'room_resumed',
  ROOM_ENDED: 'room_ended',
  ROOM_GONE_DETECTED: 'room_gone_detected', // poll 404 → reconnect guard
  ROOM_GONE_RECONNECT_CLICK: 'room_gone_reconnect_click',

  // ── host lobby ─────────────────────────────────────────────────────────────
  LOBBY_GAME_ADDED: 'lobby_game_added',
  LOBBY_GAME_REMOVED: 'lobby_game_removed',
  LOBBY_START_GAME_CLICK: 'lobby_start_game_click',
  LOBBY_START_LEAGUE_CLICK: 'lobby_start_league_click',
  LOBBY_END_SESSION_CLICK: 'lobby_end_session_click',
  // ── already-running recovery flow (the game_already_running → join/end debug path) ──
  LOBBY_START_FAILED: 'lobby_start_failed', // POST /start onError fired (any code)
  LOBBY_GAME_ALREADY_RUNNING: 'lobby_game_already_running', // the 409 code branch taken
  LOBBY_RUNNING_REFETCH_RESULT: 'lobby_running_refetch_result', // fresh lobby read: { phase, activeGame } — the crux
  LOBBY_RUNNING_PROMPT_SHOWN: 'lobby_running_prompt_shown', // join/end modal opened
  LOBBY_RUNNING_RACE_TOAST: 'lobby_running_race_toast', // fresh fetch said no game → "press Start again"
  LOBBY_JOIN_RUNNING_CLICK: 'lobby_join_running_click',
  LOBBY_END_RUNNING_CLICK: 'lobby_end_running_click',

  // ── configure ──────────────────────────────────────────────────────────────
  CONFIG_OPENED: 'config_opened',
  CONFIG_SUBMITTED: 'config_submitted',

  // ── flow routing ───────────────────────────────────────────────────────────
  FLOW_RESOLVED: 'flow_resolved', // screen resolved a flow from the registry by backendId
  FLOW_BACKEND_ID_CHANGED: 'flow_backend_id_changed', // latched id changed (should be rare!)
  FLOW_PATCH_IN: 'flow_patch_in', // flow component received a new patch (phase/idx + key fields)
  FLOW_PATCH_FULL: 'flow_patch_full', // the FULL patch object (the heavy one; mute if noisy)
  FLOW_RENDER: 'flow_render', // a flow component rendered: which stage/phase + which branch
  FLOW_DERIVED: 'flow_derived', // derived values a flow computed this render (deadline, yourScore, …)
  FLOW_NO_PATCH: 'flow_no_patch', // a flow rendered with patch === null (waiting beat)

  // ── stage machine ────────────────────────────────────────────────────────
  STAGE_INIT: 'stage_init', // hook mounted (stage machine created)
  STAGE_CHANGED: 'stage_changed', // stage transition (from → to + why)
  STAGE_DECISION: 'stage_decision', // the per-patch decision inputs (phase, idx, target, newRound…)
  STAGE_ADVANCE_CALLED: 'stage_advance_called', // intro/countdown advance()
  STAGE_FIRST_PATCH: 'stage_first_patch', // the patch that ended the intro
  STAGE_ROUND_START_TIMER: 'stage_round_start_timer', // round_start → playing timer armed/fired
  STAGE_REVEAL_TIMER: 'stage_reveal_timer', // reveal → round_scores timer armed/fired
  STAGE_TIMER_FIRED: 'stage_timer_fired', // an interstitial timer callback ran (which one)
  STAGE_UNMAPPED_PHASE: 'stage_unmapped_phase', // backend phase the config doesn't map (held stage)

  // ── in-game actions ──────────────────────────────────────────────────────
  GAME_SUBMIT_ANSWER: 'game_submit_answer',
  GAME_SUBMIT_BLOCKED: 'game_submit_blocked', // empty / already solved
  GAME_SKIP_CLICK: 'game_skip_click',
  GAME_END_CLICK: 'game_end_click',

  // ── generic UI ─────────────────────────────────────────────────────────────
  UI_MOUNTED: 'ui_mounted',
  UI_UNMOUNTED: 'ui_unmounted',
} as const;

export type LogEvent = (typeof LogEvent)[keyof typeof LogEvent];
