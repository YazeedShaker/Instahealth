-- ============================================================
-- InstaHealth — Migration 001: Create all tables
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone           VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255),
  name_ar         VARCHAR(255),
  name_en         VARCHAR(255),
  date_of_birth   DATE,
  gender          VARCHAR(10) CHECK (gender IN ('male', 'female')),
  preferred_language VARCHAR(5) DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
  sms_reminders   BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_categories (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar      VARCHAR(100) NOT NULL,
  name_en      VARCHAR(100) NOT NULL,
  slug         VARCHAR(50) UNIQUE NOT NULL,
  icon         VARCHAR(50),
  launch_phase INT DEFAULT 1,
  is_active    BOOLEAN DEFAULT FALSE,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE providers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar           VARCHAR(255) NOT NULL,
  name_en           VARCHAR(255) NOT NULL,
  category_id       UUID REFERENCES service_categories(id),
  license_number    VARCHAR(100),
  license_authority VARCHAR(100),
  license_verified  BOOLEAN DEFAULT FALSE,
  license_expiry    DATE,
  logo_url          TEXT,
  description_ar    TEXT,
  description_en    TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branches (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id                 UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name_ar                     VARCHAR(255) NOT NULL,
  name_en                     VARCHAR(255) NOT NULL,
  address_ar                  TEXT,
  address_en                  TEXT,
  governorate                 VARCHAR(100) DEFAULT 'Cairo',
  district                    VARCHAR(100),
  lat                         DECIMAL(10, 8),
  lng                         DECIMAL(11, 8),
  phone                       VARCHAR(20),
  whatsapp                    VARCHAR(20),
  operating_hours             JSONB DEFAULT '{"sat":{"open":"08:00","close":"22:00","closed":false},"sun":{"open":"08:00","close":"22:00","closed":false},"mon":{"open":"08:00","close":"22:00","closed":false},"tue":{"open":"08:00","close":"22:00","closed":false},"wed":{"open":"08:00","close":"22:00","closed":false},"thu":{"open":"08:00","close":"22:00","closed":false},"fri":{"open":null,"close":null,"closed":true}}',
  slot_duration_minutes       INT DEFAULT 30,
  instahealth_slot_allocation INT DEFAULT 5,
  holiday_mode                BOOLEAN DEFAULT FALSE,
  holiday_message_ar          TEXT,
  photos                      TEXT[] DEFAULT '{}',
  rating                      DECIMAL(3, 2) DEFAULT 0.00,
  review_count                INT DEFAULT 0,
  is_active                   BOOLEAN DEFAULT TRUE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE services (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id           UUID NOT NULL REFERENCES service_categories(id),
  name_ar               VARCHAR(255) NOT NULL,
  name_en               VARCHAR(255) NOT NULL,
  description_ar        TEXT,
  description_en        TEXT,
  preparation_notes_ar  TEXT,
  preparation_notes_en  TEXT,
  default_tat_hours     INT DEFAULT 24,
  is_active             BOOLEAN DEFAULT TRUE,
  sort_order            INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE branch_services (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id            UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  service_id           UUID NOT NULL REFERENCES services(id),
  price                DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  is_available         BOOLEAN DEFAULT TRUE,
  home_collection      BOOLEAN DEFAULT FALSE,
  home_collection_fee  DECIMAL(10, 2) DEFAULT 0,
  custom_tat_hours     INT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, service_id)
);

CREATE TABLE slots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  slot_date    DATE NOT NULL,
  slot_time    TIME NOT NULL,
  capacity     INT DEFAULT 1 CHECK (capacity > 0),
  booked_count INT DEFAULT 0 CHECK (booked_count >= 0),
  is_blocked   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, slot_date, slot_time),
  CONSTRAINT booked_not_exceed_capacity CHECK (booked_count <= capacity)
);

CREATE TABLE slot_holds (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id    UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_ref         VARCHAR(20) UNIQUE,
  user_id             UUID NOT NULL REFERENCES users(id),
  branch_id           UUID NOT NULL REFERENCES branches(id),
  slot_id             UUID NOT NULL REFERENCES slots(id),
  status              VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','pending_payment','confirmed','completed','cancelled','no_show')),
  payment_status      VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','cash','refunded','failed')),
  payment_method      VARCHAR(20) CHECK (payment_method IN ('card','fawry','vodafone_cash','orange_cash','cash',NULL)),
  total_amount        DECIMAL(10, 2),
  commission_amount   DECIMAL(10, 2),
  commission_rate     DECIMAL(5, 4) DEFAULT 0.1200,
  patient_notes       TEXT,
  cancellation_reason TEXT,
  cancelled_by        VARCHAR(20) CHECK (cancelled_by IN ('patient','provider','admin',NULL)),
  paymob_order_id     VARCHAR(255),
  confirmed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE booking_services (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  branch_service_id UUID NOT NULL REFERENCES branch_services(id),
  price_at_booking  DECIMAL(10, 2) NOT NULL,
  quantity          INT DEFAULT 1 CHECK (quantity > 0)
);

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id       UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  amount           DECIMAL(10, 2) NOT NULL,
  currency         VARCHAR(5) DEFAULT 'EGP',
  method           VARCHAR(20),
  status           VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  gateway_txn_id   VARCHAR(255),
  gateway_order_id VARCHAR(255),
  gateway_response JSONB,
  refund_amount    DECIMAL(10, 2),
  refunded_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) UNIQUE,
  user_id     UUID NOT NULL REFERENCES users(id),
  branch_id   UUID NOT NULL REFERENCES branches(id),
  rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  is_flagged  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE provider_users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  provider_id  UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  branch_ids   UUID[] DEFAULT '{}',
  role         VARCHAR(20) DEFAULT 'receptionist' CHECK (role IN ('receptionist','branch_manager','provider_admin')),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name         VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id    UUID REFERENCES bookings(id),
  user_id       UUID REFERENCES users(id),
  type          VARCHAR(50) NOT NULL,
  channel       VARCHAR(20) DEFAULT 'sms' CHECK (channel IN ('sms','push','email')),
  recipient     VARCHAR(255) NOT NULL,
  message       TEXT NOT NULL,
  status        VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
