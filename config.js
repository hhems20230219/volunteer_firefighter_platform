window.AppConfig = Object.freeze({
    USE_ONLINE_DATA: false,
    API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxbhdI4Tr73CPKbhEeD-Ndxosg82x1IRhr2MaNUcLqx5KEUtlE2sR86hh_mHeeII5OW/exec',
    API_TIMEOUT_MS: 30000,

    AUTH_STORAGE_KEY: 'volunteerFirefighterAuth',
    SAMPLE_DATA_VERSION: '2026.08.06-v15',
    NATIONAL_ID_MIGRATIONS: { 'E123456789': 'E123714468' },
    GEOLOCATION_ENABLED: true,
    RULE_CALCULATION_START_DATE: '2026-01-01',
    GEOLOCATION_TIMEOUT_MS: 15000,
    GEOLOCATION_MAX_AGE_MS: 0,
    GEOLOCATION_ALLOWED_RADIUS_METERS: 300,
    ALLOWED_DUTY_LOCATIONS: [
        { name: '日月光K11', lat: 22.72221409885418, lng: 120.30464711481426 },
        { name: '吉林街', lat: 22.644364761041626, lng: 120.30651999999968 },
        { name: '新興分隊', lat: 22.6309519358328, lng: 120.31120251097644 }
    ],

    ENABLE_DEBUG_LOG: true
});
