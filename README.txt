Deploy:
npx wrangler deploy

Run worker dev:
npx wrangler dev --ip 0.0.0.0 --port 8787 --local-protocol https

Run SQL Command (COMMAND D1):
- show table structure:
npx wrangler d1 execute db_presensi --command="PRAGMA table_info(tb_admin)"

- command:
npx wrangler d1 execute db_presensi --command=""

- schema.sql
npx wrangler d1 execute db_presensi --file=.\src\schema.sql



Tambah kolom di tabel:

1. kalau ada foreign key di kolom baru:
PRAGMA foreign_keys = ON;

2. buat tabel sementara (copy dari tabel yg ingin diubah, dan tambahkan kolom baru yg diinginkan), misal (penambahan kolom id_gender):

CREATE TABLE IF NOT EXISTS tb_presensi_new (
	id_presensi INTEGER PRIMARY KEY AUTOINCREMENT,
	id_acara INTEGER NOT NULL,
	waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
	nama TEXT NOT NULL CHECK(LENGTH(nama) <= 100),
	id_subgroup INTEGER NOT NULL,
	jabatan TEXT NOT NULL CHECK(LENGTH(jabatan) <= 100),
	id_jenis_kepegawaian INTEGER NOT NULL,
	id_gender INTEGER NOT NULL,
	no_hp TEXT NOT NULL CHECK(LENGTH(no_hp) <= 20),
	email TEXT NOT NULL CHECK(LENGTH(email) <= 255),
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	id_device TEXT NOT NULL CHECK(LENGTH(id_device) <= 100),
	FOREIGN KEY (id_acara) REFERENCES tb_acara(id_acara) ON UPDATE CASCADE,
	FOREIGN KEY (id_subgroup) REFERENCES tb_subgroup(id_subgroup) ON UPDATE CASCADE,
	FOREIGN KEY (id_jenis_kepegawaian) REFERENCES tb_jenis_kepegawaian(id_jenis_kepegawaian) ON UPDATE CASCADE,
	FOREIGN KEY (id_gender) REFERENCES tb_gender(id_gender) ON UPDATE CASCADE
);

3. salin data dari tabel lama (plus nilai untuk kolom baru) ke tabel baru
INSERT INTO tb_presensi_new (
	id_presensi, id_acara, waktu, nama, id_subgroup, jabatan, id_jenis_kepegawaian, id_gender, no_hp, email, latitude, longitude, id_device
)
SELECT
	id_presensi, id_acara, waktu, nama, id_subgroup, jabatan, 1, 1, 1, no_hp, 'emaildefault', latitude, longitude, id_device
FROM tb_presensi;

4. Hapus tabel lama
DROP TABLE tb_presensi;

5. Ganti nama tabel baru
ALTER TABLE tb_presensi_new RENAME TO tb_presensi;
