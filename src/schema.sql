/* presensi-backend/src/schema.sql */
/*
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
*/
/*
CREATE TABLE IF NOT EXISTS tb_admin (
	id_admin INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL CHECK(LENGTH(username) <= 30),
	password_hash TEXT NOT NULL,
	type_admin TEXT NOT NULL CHECK(type_admin IN ('super', 'biasa')),
	status_admin TEXT NOT NULL CHECK(status_admin IN ('aktif', 'nonaktif'))
);
*/
/*
INSERT INTO tb_acara (nama_acara, tanggal, jam, lokasi, latitude, longitude, radius, jml_peserta)
VALUES ('Rakor X', '2025-11-10', '09:00', 'Gedung A', 1.1483402791188564, 104.0253072363915, 100, 200);


INSERT INTO tb_acara (nama_acara, tanggal, jam, lokasi, latitude, longitude, radius, jml_peserta)
VALUES ('Sosialissi YYY', '2025-12-01', '13:00', 'Ruang Rapat Bapenda', 1.124565, 104.058141, 100, 50);
*/

/*
CREATE TABLE IF NOT EXISTS tb_presensi (
	id_presensi INTEGER PRIMARY KEY AUTOINCREMENT,
	id_acara INTEGER NOT NULL,
	waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
	nama TEXT NOT NULL CHECK(LENGTH(nama) <= 100),
	id_subgroup INTEGER NOT NULL,
	jabatan TEXT NOT NULL CHECK(LENGTH(jabatan) <= 100),
	no_hp TEXT NOT NULL CHECK(LENGTH(no_hp) <= 20),
	latitude REAL NOT NULL,
	longitude REAL NOT NULL,
	id_device TEXT NOT NULL CHECK(LENGTH(id_device) <= 100),
	FOREIGN KEY (id_acara) REFERENCES tb_acara(id_acara) ON UPDATE CASCADE,
	FOREIGN KEY (id_subgroup) REFERENCES tb_subgroup(id_subgroup) ON UPDATE CASCADE
);
*/

/*
CREATE TABLE IF NOT EXISTS tb_group (
	id_group INTEGER PRIMARY KEY AUTOINCREMENT,
	nama_group TEXT NOT NULL CHECK(LENGTH(nama_group) <= 100)
);
*/
/*
CREATE TABLE IF NOT EXISTS tb_subgroup (
	id_subgroup INTEGER PRIMARY KEY AUTOINCREMENT,
	nama_subgroup TEXT NOT NULL CHECK(LENGTH(nama_subgroup) <= 255),
	id_group INTEGER NOT NULL,
	FOREIGN KEY (id_group) REFERENCES tb_group(id_group) ON UPDATE CASCADE
);
*/
/*
PRAGMA foreign_keys = ON;
*/
/*
CREATE TABLE IF NOT EXISTS tb_undangan (
	id_undangan INTEGER PRIMARY KEY AUTOINCREMENT,
	id_acara INTEGER NOT NULL,
	id_subgroup INTEGER NOT NULL,
	UNIQUE (id_acara, id_subgroup),
	FOREIGN KEY (id_acara) REFERENCES tb_acara(id_acara) ON UPDATE CASCADE,
	FOREIGN KEY (id_subgroup) REFERENCES tb_subgroup(id_subgroup) ON UPDATE CASCADE
);
*/
/*
INSERT INTO tb_group (nama_group)
VALUES
("Kementerian"),
("Badan"),
("Bagian"),
("Dinas"),
("UPTD"),
("Kecamatan"),
("Kelurahan"),
("Bidang");
*/
/*
INSERT INTO tb_subgroup (nama_subgroup, id_group)
VALUES
('Kementerian Keuangan', 1),
('Kementerian Dalam Negeri', 1),
('Badan Pendapatan Daerah Kota Batam', 2),
('Badan Pengelolaan Keuangan & Aset Daerah Kota Batam', 2),
('Badan Perencanaan & Penelitian Pengembangan Pembangunan Daerah Kota Batam', 2),
('Badan Kepegawaian & Pengembangan Sumber Daya Manusia Kota Batam', 2),
('Badan Kesatuan Bangsa & Politik Kota Batam', 2),
('Dinas Kesehatan Kota Batam', 4),
('Dinas Bina Marga & Sumber Air Kota Batam', 4),
('Dinas Cipta Karya & Tata Ruang Kota Batam', 4),
('Dinas Pendidikan Kota Batam', 4),
('Dinas Sosial & Pemberdayaan Masyarakat Kota Batam', 4),
('Dinas Tenaga Kerja Kota Batam', 4),
('Dinas Pemberdayaan Perempuan Kota Batam', 4),
('Dinas Perlindungan Anak, Pengendalian Penduduk & Keluarga Berencana Kota Batam', 4),
('Dinas Pemadam Kebakaran & Penyelamatan Kota Batam', 4),
('Dinas Ketahanan Pangan & Pertanian Kota Batam', 4),
('Dinas Perikanan Kota Batam', 4),
('Dinas Komunikasi & Informatika Kota Batam', 4),
('Dinas Perindustrian & Perdagangan Kota Batam', 4),
('Dinas Koperasi & Usaha Mikro Kota Batam', 4),
('Dinas Penanaman Modal Pelayanan Terpadu Satu Pintu Kota Batam', 4),
('Dinas Perhubungan Kota Batam', 4),
('Dinas Kependudukan & Pencatatan Sipil Kota Batam', 4),
('Dinas Kebudayaan & Pariwisata Kota Batam', 4),
('Dinas Perumahan Kawasan Permukiman & Pertamanan Kota Batam', 4),
('Dinas Pertanahan Kota Batam', 4),
('Dinas Perpustakaan & Kearsipan Kota Batam', 4),
('Dinas Kepemudaan & Olahraga Kota Batam', 4),
('Dinas Lingkungan Hidup Kota Batam', 4),
('UPTD Instalasi Farmasi Kota Batam', 5),
('UPTD Puskesmas Baloi Permai Kota Batam', 5),
('UPTD Puskesmas Batu Aji Kota Batam', 5),
('UPTD Puskesmas Belakang Padang Kota Batam', 5),
('UPTD Puskesmas Botania Kota Batam', 5),
('UPTD Puskesmas Bulang Kota Batam', 5),
('UPTD Puskesmas Kabil Kota Batam', 5),
('UPTD Puskesmas Kampung Jabi Kota Batam', 5),
('UPTD Puskesmas Lubuk Baja Kota Batam', 5),
('UPTD Puskesmas Mentarau Kota Batam', 5),
('UPTD Puskesmas Rempang Cate Kota Batam', 5),
('UPTD Puskesmas Sambau Kota Batam', 5),
('UPTD Puskesmas Sei Langkai Kota Batam', 5),
('UPTD Puskesmas Sei Lekop Kota Batam', 5),
('UPTD Puskesmas Sei Panas Kota Batam', 5),
('UPTD Puskesmas Sei Pancur Kota Batam', 5),
('UPTD Puskesmas Sekupang Kota Batam', 5),
('UPTD Puskesmas Tanjung Buntung Kota Batam', 5),
('UPTD Puskesmas Tanjung Sengkuang Kota Batam', 5),
('UPTD Puskesmas Tanjung Uncang Kota Batam', 5),
('UPTD Puskesmas Tiban Baru Kota Batam', 5);
*/
/*
INSERT INTO tb_undangan (id_acara, id_subgroup)
VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(1, 34),
(1, 35),
(1, 36),
(1, 37),
(1, 38),
(1, 39),
(1, 40),
(1, 41),
(1, 42),
(1, 43),
(1, 44),
(1, 45),
(1, 46),
(1, 47),
(1, 48),
(1, 49),
(1, 50),
(1, 51)
;
*/
/*
INSERT INTO tb_undangan (id_acara, id_subgroup)
VALUES
(2, 1),
(2, 2),
(2, 3),
(2, 4),
(2, 5),
(2, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10)
;
*/