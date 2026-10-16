-- Sumber konten default kini otakudesu (sub Indo) lewat wajik-anime-api.
-- Kolom `source` selalu diisi eksplisit oleh repository; default ini hanya
-- jaring pengaman untuk pemasangan baru.

ALTER TABLE content_index ALTER COLUMN source SET DEFAULT 'otakudesu';
ALTER TABLE rooms ALTER COLUMN source SET DEFAULT 'otakudesu';
ALTER TABLE favorites ALTER COLUMN source SET DEFAULT 'otakudesu';
ALTER TABLE watch_history ALTER COLUMN source SET DEFAULT 'otakudesu';
