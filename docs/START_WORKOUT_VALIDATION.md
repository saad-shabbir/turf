# Start workout from today's plan

Today's unfinished planned workout cards now include Start workout. With location services and permission enabled, a fresh accurate position must fall within a saved enabled place. A failed position lookup cannot bypass this check. With services or permission off, users can start a manual timer. An existing active timer is reused.

New button-started timers persist locally, support workout selection and restart, and require Stop to finish. They save as manual, unverified sessions, including when the start was checked at a saved place. They do not claim studio-board attendance. Offline stops queue durably; retries use the same session ID. Automatic arrival tracking retains its existing departure behavior.

Validation: typecheck, lint and config checks passed; 70 database tests passed. Focused tests cover location gating, denied permission, GPS failure, duplicate starts, offline stop/retry, identity ownership and Live Activity updates. Browser preview verified the planned-card action opens the active timer. The additive hosted save function was deployed and verified owner-bound, authenticated-only, with existing data preserved. Rollback: revoke authenticated execution of cs_timed_session(jsonb); queued phone records remain intact.

Physical iPhone location and background behavior still require a device walkthrough. This is not evidence that the earlier missing field visit has been recovered.
