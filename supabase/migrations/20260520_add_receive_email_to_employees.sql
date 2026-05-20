ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS receive_email boolean NOT NULL DEFAULT false;
