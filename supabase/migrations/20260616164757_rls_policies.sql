ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots            ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_holds       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: patient sees own row" ON users FOR SELECT USING (id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "users: patient inserts own row" ON users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users: patient updates own row" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users: admin full access" ON users FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "providers: public read active" ON providers FOR SELECT USING (is_active = TRUE OR get_user_role() = 'admin');
CREATE POLICY "providers: admin full access" ON providers FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "branches: public read active" ON branches FOR SELECT USING ((is_active = TRUE) OR (get_user_role() IN ('admin', 'provider')));
CREATE POLICY "branches: provider updates own branches" ON branches FOR UPDATE USING (id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "branches: admin full access" ON branches FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "categories: public read active" ON service_categories FOR SELECT USING (is_active = TRUE OR get_user_role() = 'admin');
CREATE POLICY "categories: admin full access" ON service_categories FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "services: public read active" ON services FOR SELECT USING (is_active = TRUE OR get_user_role() = 'admin');
CREATE POLICY "services: admin full access" ON services FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "branch_services: public read" ON branch_services FOR SELECT USING (TRUE);
CREATE POLICY "branch_services: provider updates own" ON branch_services FOR UPDATE USING (branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "branch_services: admin full access" ON branch_services FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "slots: patient sees available only" ON slots FOR SELECT USING ((is_blocked = FALSE AND booked_count < capacity) OR branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "slots: provider updates own" ON slots FOR UPDATE USING (branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "slots: admin full access" ON slots FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "slot_holds: patient own" ON slot_holds FOR SELECT USING (user_id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "slot_holds: patient creates own" ON slot_holds FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "slot_holds: patient deletes own" ON slot_holds FOR DELETE USING (user_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "bookings: patient sees own" ON bookings FOR SELECT USING (user_id = auth.uid() OR branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "bookings: patient creates own" ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "bookings: provider updates status" ON bookings FOR UPDATE USING (branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin');
CREATE POLICY "bookings: admin full access" ON bookings FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "booking_services: see if booking is accessible" ON booking_services FOR SELECT USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.user_id = auth.uid() OR b.branch_id = ANY(get_provider_branch_ids()) OR get_user_role() = 'admin')));
CREATE POLICY "booking_services: patient inserts own" ON booking_services FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

CREATE POLICY "payments: patient sees own" ON payments FOR SELECT USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()) OR get_user_role() = 'admin');
CREATE POLICY "payments: admin full access" ON payments FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "reviews: public read unflagged" ON reviews FOR SELECT USING (is_flagged = FALSE OR get_user_role() = 'admin');
CREATE POLICY "reviews: patient inserts own" ON reviews FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND b.user_id = auth.uid() AND b.status = 'completed'));
CREATE POLICY "reviews: patient updates own" ON reviews FOR UPDATE USING (user_id = auth.uid() OR get_user_role() = 'admin');

CREATE POLICY "provider_users: see own record" ON provider_users FOR SELECT USING (auth_user_id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "provider_users: admin full access" ON provider_users FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "admin_users: admin only" ON admin_users FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "notifications: user sees own" ON notifications FOR SELECT USING (user_id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "notifications: admin full access" ON notifications FOR ALL USING (get_user_role() = 'admin');
