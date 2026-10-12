// Redaksi data sensitif (TECH-SPEC §11, PRD §9.2) — re-export detektor bersama klien & Edge.
export { detectSensitive, hasSensitive, redact, SENSITIVE_MESSAGE, type SensitiveKind } from './common/sensitive.ts';
