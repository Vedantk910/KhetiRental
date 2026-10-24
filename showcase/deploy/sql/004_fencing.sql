-- Backstop for the fencing predicate (fencing_token <= $token): whatever the
-- caller's SQL, a row's token never moves backwards.
CREATE OR REPLACE FUNCTION bookings_fencing_never_decreases() RETURNS trigger AS $$
BEGIN
    IF NEW.fencing_token < OLD.fencing_token THEN
        RAISE EXCEPTION 'fencing_token decreased from % to %', OLD.fencing_token, NEW.fencing_token;
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER bookings_fencing_never_decreases
    BEFORE UPDATE OF fencing_token ON bookings
    FOR EACH ROW EXECUTE FUNCTION bookings_fencing_never_decreases();
