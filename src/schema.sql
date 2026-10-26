PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS centres (
 id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE CHECK(length(code)=5), name TEXT NOT NULL, country TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('candidate','centre_admin','super_admin')), centre_id INTEGER REFERENCES centres(id), verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, disabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS candidates (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 candidate_number TEXT UNIQUE,
 family_name TEXT, first_name TEXT, dob TEXT, sex TEXT, country_origin TEXT, nationality TEXT, first_language TEXT, id_document TEXT, phone TEXT, photo_path TEXT, consent_at TEXT, deletion_requested_at TEXT
);
CREATE TABLE IF NOT EXISTS tokens (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('email','reset')), token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 id INTEGER PRIMARY KEY, centre_id INTEGER NOT NULL REFERENCES centres(id), test_date TEXT NOT NULL, start_time TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity>0), notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), session_id INTEGER NOT NULL REFERENCES sessions(id), status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','cancelled')), payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')), checked_in_at TEXT, booked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, cancelled_at TEXT, UNIQUE(user_id, session_id)
);
CREATE TABLE IF NOT EXISTS results (
 id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id), listening INTEGER CHECK(listening BETWEEN 0 AND 100), reading INTEGER CHECK(reading BETWEEN 0 AND 100), writing INTEGER CHECK(writing BETWEEN 0 AND 100), speaking INTEGER CHECK(speaking BETWEEN 0 AND 100), overall INTEGER CHECK(overall BETWEEN 0 AND 100), cefr TEXT, comments TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')), submitted_at TEXT, approved_at TEXT, approved_by INTEGER REFERENCES users(id), rejection_reason TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS certificates (
 id INTEGER PRIMARY KEY, result_id INTEGER NOT NULL REFERENCES results(id), form_number TEXT NOT NULL UNIQUE, security_hash TEXT NOT NULL UNIQUE, issue_date TEXT NOT NULL, expiry_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid','revoked','reissued')), revoked_reason TEXT, revoked_at TEXT, filename TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cefr_bands (label TEXT PRIMARY KEY, min_score INTEGER NOT NULL UNIQUE, max_score INTEGER NOT NULL UNIQUE, sort_order INTEGER NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, last_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, details TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS privacy_requests (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_review','completed','declined')), reviewed_at TEXT, reviewer_id INTEGER REFERENCES users(id), review_note TEXT);
CREATE TABLE IF NOT EXISTS verification_logs (id INTEGER PRIMARY KEY, ip_hash TEXT NOT NULL, form_hash TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(test_date,centre_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id,status);
CREATE INDEX IF NOT EXISTS idx_results_status ON results(status);
CREATE INDEX IF NOT EXISTS idx_certs_result ON certificates(result_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_verify_created ON verification_logs(created_at);

-- Versioned signatory approvals (additive migration; existing SQLite files are not altered).
-- Old signature files remain immutable so issued PDF reports never change retrospectively.
CREATE TABLE IF NOT EXISTS centre_signatures (
 id INTEGER PRIMARY KEY,
 centre_id INTEGER NOT NULL REFERENCES centres(id),
 signatory_name TEXT NOT NULL,
 signatory_title TEXT NOT NULL,
 image_file TEXT NOT NULL UNIQUE,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 retired_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_centre_signatures_active ON centre_signatures(centre_id) WHERE active=1;
CREATE INDEX IF NOT EXISTS idx_centre_signatures_centre ON centre_signatures(centre_id,created_at);
-- Permanent snapshot binding to a given certificate. Older certificates have no mapping.
CREATE TABLE IF NOT EXISTS certificate_signatures (
 certificate_id INTEGER PRIMARY KEY REFERENCES certificates(id),
 signature_id INTEGER NOT NULL REFERENCES centre_signatures(id)
);

-- GEST pilot scoring v1.0. Additive-only migration: legacy results remain unchanged.
CREATE TABLE IF NOT EXISTS pilot_forms (
 id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
 reading_key TEXT NOT NULL, listening_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pilot_session_forms (
 session_id INTEGER PRIMARY KEY REFERENCES sessions(id),
 form_id INTEGER NOT NULL REFERENCES pilot_forms(id),
 assigned_by INTEGER NOT NULL REFERENCES users(id), assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pilot_assessments (
 booking_id INTEGER PRIMARY KEY REFERENCES bookings(id), form_id INTEGER NOT NULL REFERENCES pilot_forms(id),
 reading_responses TEXT NOT NULL, listening_responses TEXT NOT NULL,
 reading_correct INTEGER NOT NULL, listening_correct INTEGER NOT NULL,
 reading_score INTEGER NOT NULL, listening_score INTEGER NOT NULL,
 speaking_rubric TEXT NOT NULL, speaking_score INTEGER NOT NULL,
 updated_by INTEGER NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 submitted_at TEXT
);
CREATE TABLE IF NOT EXISTS pilot_writing_marks (
 id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES bookings(id),
 assessor_id INTEGER NOT NULL REFERENCES users(id),
 task1_json TEXT NOT NULL, task2_json TEXT NOT NULL,
 task1_score INTEGER NOT NULL, task2_score INTEGER NOT NULL,
 score INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(booking_id,assessor_id)
);
CREATE INDEX IF NOT EXISTS idx_pilot_marks_booking ON pilot_writing_marks(booking_id);
CREATE TABLE IF NOT EXISTS pilot_result_snapshots (
 result_id INTEGER PRIMARY KEY REFERENCES results(id), form_id INTEGER NOT NULL REFERENCES pilot_forms(id),
 version TEXT NOT NULL, snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- An examiner cannot silently replace a Headquarters answer key or reassign a form after marking starts.
CREATE TRIGGER IF NOT EXISTS pilot_form_immutable_update BEFORE UPDATE ON pilot_forms
BEGIN SELECT RAISE(ABORT,'Pilot answer keys are immutable; create a new form version'); END;
CREATE TRIGGER IF NOT EXISTS pilot_form_immutable_delete BEFORE DELETE ON pilot_forms
BEGIN SELECT RAISE(ABORT,'Pilot answer keys cannot be deleted'); END;
CREATE TRIGGER IF NOT EXISTS pilot_assignment_immutable_update BEFORE UPDATE ON pilot_session_forms
BEGIN SELECT RAISE(ABORT,'Pilot session form assignment is immutable'); END;
CREATE TRIGGER IF NOT EXISTS pilot_assignment_immutable_delete BEFORE DELETE ON pilot_session_forms
BEGIN SELECT RAISE(ABORT,'Pilot session form assignment cannot be deleted'); END;

-- Candidate Identity Verification 2.0 (additive; retains historical bookings/results).
-- Sensitive documents are encrypted at rest in storage/identity-documents, not public/.
CREATE TABLE IF NOT EXISTS candidate_identity_documents (
 user_id INTEGER PRIMARY KEY REFERENCES candidates(user_id),
 document_type TEXT NOT NULL CHECK(document_type IN ('passport','national_id')),
 storage_filename TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg')),
 sha256 TEXT NOT NULL,
 size_bytes INTEGER NOT NULL,
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_by INTEGER REFERENCES users(id),
 reviewed_at TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected'))
);
CREATE TABLE IF NOT EXISTS booking_identity_checks (
 booking_id INTEGER PRIMARY KEY REFERENCES bookings(id),
 document_sha256 TEXT NOT NULL,
 official_photo_path TEXT NOT NULL UNIQUE,
 verified_by INTEGER NOT NULL REFERENCES users(id),
 verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_identity_doc_status ON candidate_identity_documents(status,uploaded_at);

-- v1.4 simulated payments and limited institutional fee-waiver allocations.
-- No real gateway credentials, card data, or plaintext coupon codes are stored.
CREATE TABLE IF NOT EXISTS fee_waiver_institutions (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
 kind TEXT NOT NULL CHECK(kind IN ('school','university','nonprofit','partner')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS fee_waiver_batches (
 id INTEGER PRIMARY KEY,
 institution_id INTEGER NOT NULL REFERENCES fee_waiver_institutions(id),
 centre_id INTEGER REFERENCES centres(id),
 percent INTEGER NOT NULL CHECK(percent IN (25,50,100)),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 expiry_date TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_by INTEGER NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS fee_waiver_coupons (
 id INTEGER PRIMARY KEY,
 batch_id INTEGER NOT NULL REFERENCES fee_waiver_batches(id),
 token_hash TEXT NOT NULL UNIQUE,
 redeemed_booking_id INTEGER UNIQUE REFERENCES bookings(id),
 redeemed_at TEXT, voided_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fee_coupons_batch ON fee_waiver_coupons(batch_id);
CREATE TABLE IF NOT EXISTS payment_orders (
 id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
 original_amount INTEGER NOT NULL CHECK(original_amount>0),
 discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
 amount_due INTEGER NOT NULL CHECK(amount_due>=0),
 coupon_id INTEGER UNIQUE REFERENCES fee_waiver_coupons(id),
 provider TEXT NOT NULL DEFAULT 'sandbox' CHECK(provider='sandbox'),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','failed','paid','waived')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(original_amount=discount_amount+amount_due)
);
CREATE TABLE IF NOT EXISTS payment_events (
 id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
 action TEXT NOT NULL CHECK(action IN ('coupon_applied','sandbox_attempt','sandbox_retry')),
 outcome TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id,created_at);
