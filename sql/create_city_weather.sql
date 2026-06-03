-- Chạy SQL này trong Supabase SQL Editor (https://supabase.com/dashboard/project/bbpmkmmmsqurszpnvsba/sql/new)
-- Tạo bảng cache thời tiết / AQI, dùng làm fallback khi OpenWeatherMap API lỗi

DROP TABLE IF EXISTS city_weather CASCADE;

CREATE TABLE IF NOT EXISTS city_weather (
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  city_name     TEXT NOT NULL,
  country       TEXT NOT NULL,
  temperature   DOUBLE PRECISION,
  pm2_5         DOUBLE PRECISION,
  aqi           INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (lat, lng)
);

-- Cho phép anon key đọc/ghi (RLS)
ALTER TABLE city_weather ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can select" ON city_weather
  FOR SELECT USING (true);

CREATE POLICY "anon can insert" ON city_weather
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon can update" ON city_weather
  FOR UPDATE USING (true) WITH CHECK (true);
