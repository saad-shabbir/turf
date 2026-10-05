# October 4 tracking investigation

Fixed an iPhone module-resolution defect: the generic Live Activity `.ts` adapter shadowed the `.ios.tsx` implementation because Metro checks source extensions in order. A same-extension `.ios.ts` entry point now selects the actual iPhone layout. A regression test uses Metro's real resolver for iOS and Android. Ten lifecycle tests pass with the native adapter mocked; physical rendering remains unverified.

Debug now refreshes after failed actions and shows the time of the latest sync attempt. The shared request timeout is increased from five to twenty seconds to allow slower connections. This does not establish the cause of the reported network loss. Existing queue acknowledgement, ownership checks and preserved-event holds are unchanged; no events are discarded or reclassified.

Typecheck, lint, Metro resolution, Live Activity lifecycle and local sync-recovery tests passed. The iOS bundle includes the actual widget implementation. No hosted records were edited; recovery of missing field visits requires reviewing server and/or device evidence and checking existing manual sessions for duplicates.
