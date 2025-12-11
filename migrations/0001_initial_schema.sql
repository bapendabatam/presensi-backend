/* presensi-backend/migrations/0001_initial_schema.sql */

CREATE TABLE IF NOT EXISTS tb_acara (
	id_acara INTEGER PRIMARY KEY AUTOINCREMENT,
	nama_acara TEXT NOT NULL CHECK(LENGTH(nama_acara) <= 100),
	tanggal DATE NOT NULL,
	jam TIME NOT NULL,
	lokasi TEXT NOT NULL CHECK(LENGTH(lokasi) <= 255),
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	radius INTEGER DEFAULT 100,
	jml_peserta INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tb_admin (
	id_admin INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL CHECK(LENGTH(username) <= 30),
	password_hash TEXT NOT NULL,
	type_admin TEXT NOT NULL CHECK(type_admin IN ('super', 'biasa')),
	status_admin TEXT NOT NULL CHECK(status_admin IN ('aktif', 'nonaktif'))
);

CREATE TABLE IF NOT EXISTS tb_presensi (
	id_presensi INTEGER PRIMARY KEY AUTOINCREMENT,
	id_acara INTEGER NOT NULL,
	waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
	nama TEXT NOT NULL CHECK(LENGTH(nama) <= 100),
	id_subgroup INTEGER NOT NULL,
	jabatan TEXT NOT NULL CHECK(LENGTH(jabatan) <= 100),
	gender TEXT NOT NULL CHECK(LENGTH(gender) <= 1),
	no_hp TEXT NOT NULL CHECK(LENGTH(no_hp) <= 20),
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	id_device TEXT NOT NULL CHECK(LENGTH(id_device) <= 100),
	FOREIGN KEY (id_acara) REFERENCES tb_acara(id_acara) ON UPDATE CASCADE,
	FOREIGN KEY (id_subgroup) REFERENCES tb_subgroup(id_subgroup) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_group (
	id_group INTEGER PRIMARY KEY AUTOINCREMENT,
	nama_group TEXT NOT NULL CHECK(LENGTH(nama_group) <= 100)
);

CREATE TABLE IF NOT EXISTS tb_subgroup (
	id_subgroup INTEGER PRIMARY KEY AUTOINCREMENT,
	nama_subgroup TEXT NOT NULL CHECK(LENGTH(nama_subgroup) <= 255),
	id_group INTEGER NOT NULL,
	FOREIGN KEY (id_group) REFERENCES tb_group(id_group) ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tb_undangan (
	id_undangan INTEGER PRIMARY KEY AUTOINCREMENT,
	id_acara INTEGER NOT NULL,
	id_subgroup INTEGER NOT NULL,
	UNIQUE (id_acara, id_subgroup),
	FOREIGN KEY (id_acara) REFERENCES tb_acara(id_acara) ON UPDATE CASCADE,
	FOREIGN KEY (id_subgroup) REFERENCES tb_subgroup(id_subgroup) ON UPDATE CASCADE
);