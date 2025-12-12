// presensi-backend/src/db/queries.js

export async function getAcara(db, idAcara) {
	const { results } = await db.prepare(
		"SELECT * FROM tb_acara WHERE id_acara = ?"
	).bind(parseInt(idAcara)).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function getDataPresensi(db, idAcara) {
	const { results } = await db.prepare(
		`SELECT 
			tb_presensi.*, 
			tb_subgroup.nama_subgroup,
			tb_gender.gender,
			tb_jenis_kepegawaian.jenis_kepegawaian
		FROM tb_presensi 
		JOIN tb_subgroup 
			ON tb_presensi.id_subgroup = tb_subgroup.id_subgroup
		JOIN tb_jenis_kepegawaian 
			ON tb_presensi.id_jenis_kepegawaian = tb_jenis_kepegawaian.id_jenis_kepegawaian
		JOIN tb_gender 
			ON tb_presensi.id_gender = tb_gender.id_gender
		WHERE tb_presensi.id_acara = ?
		ORDER BY tb_presensi.waktu ASC`
	).bind(parseInt(idAcara)).all();
	
	return results;
}

export async function getAllSubgroups(db) {
	const { results } = await db.prepare(
		`SELECT 
			tb_subgroup.*,
			tb_group.*
		FROM tb_subgroup 
		JOIN tb_group 
		ON tb_subgroup.id_group = tb_group.id_group`
	).all();
	
	return results;
}

export async function getDataUndangan(db, idAcara) {
	const { results } = await db.prepare(
		`SELECT 
			tb_undangan.*, 
			tb_subgroup.nama_subgroup,
			tb_group.nama_group
		FROM tb_undangan 
		JOIN tb_subgroup ON tb_undangan.id_subgroup = tb_subgroup.id_subgroup
		JOIN tb_group ON tb_subgroup.id_group = tb_group.id_group
		WHERE tb_undangan.id_acara = ?`
	).bind(parseInt(idAcara)).all();
	
	return results;
}

export async function getDataAcara(db) {
	const { results } = await db.prepare(`SELECT * FROM tb_acara ORDER BY id_acara DESC`).all();
	return results;
}
 
export async function insertPresensi(db, data) {
	const waktu_input = Date.now();
	
	const insertResult = await db.prepare(
		`INSERT INTO tb_presensi (
			id_acara,
			waktu,
			nama,
			id_subgroup,
			jabatan,
			id_jenis_kepegawaian,
			id_gender,
			no_hp,
			email,
			latitude,
			longitude,
			id_device
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		parseInt(data.idAcara),
		waktu_input,
		data.nama,
		parseInt(data.idSubGroup),
		data.jabatan,
		data.idJenisKepegawaian,
		data.idGender,
		data.noHp,
		data.email,
		data.latitude,
		data.longitude,
		data.idDevice
	).run();
	
	if (!insertResult.success || insertResult.meta.last_row_id === undefined) {
		console.error("Gagal melakukan INSERT presensi:", insertResult);
		return null;
	}
	
	const newRowId = insertResult.meta.last_row_id;
	
	const { results } = await db.prepare(
		`SELECT 
			tb_presensi.*, 
			tb_subgroup.nama_subgroup,
			tb_acara.nama_acara,
			tb_gender.gender,
			tb_jenis_kepegawaian.jenis_kepegawaian
		FROM tb_presensi
		JOIN tb_subgroup 
			ON tb_presensi.id_subgroup = tb_subgroup.id_subgroup
		JOIN tb_acara 
			ON tb_presensi.id_acara = tb_acara.id_acara
		JOIN tb_jenis_kepegawaian 
			ON tb_presensi.id_jenis_kepegawaian = tb_jenis_kepegawaian.id_jenis_kepegawaian
		JOIN tb_gender 
			ON tb_presensi.id_gender = tb_gender.id_gender
		WHERE tb_presensi.ROWID = ?`
	).bind(newRowId).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function getGroup(db, data) {
	const { results } = await db.prepare(
		`SELECT id_group FROM tb_group WHERE nama_group = ?`
	).bind(data.namaGroup).all();
	
	return results;
}

export async function getSubGroup(db, data) {
	const { results } = await db.prepare(
		`SELECT id_subgroup FROM tb_subgroup WHERE nama_subgroup = ? AND id_group = ?`
	).bind(data.namaSubGroup, parseInt(data.idGroup)).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function insertSubGroup(db, data) {
	const insertResult = await db.prepare(`INSERT INTO tb_subgroup (nama_subgroup, id_group) VALUES (?, ?)`).bind(data.namaSubGroup, parseInt(data.idGroup)).run();
	
	if (!insertResult.success || insertResult.meta.last_row_id === undefined) {
		console.error("Gagal melakukan INSERT subgroup:", insertResult);
		return null;
	}
	
	const newRowId = insertResult.meta.last_row_id;
	
	const { results } = await db.prepare(
		`SELECT tb_subgroup.*, tb_group.nama_group
		FROM tb_subgroup
		JOIN tb_group
		ON tb_subgroup.id_group = tb_group.id_group
		WHERE tb_subgroup.ROWID = ?`
	).bind(newRowId).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function insertGroup(db, data) {
	const insertResult = await db.prepare(
		`INSERT INTO tb_group (nama_group) VALUES (?)`
	).bind(data.namaGroup).run();
	
	if (!insertResult.success || insertResult.meta.last_row_id === undefined) {
		console.error("Gagal melakukan INSERT group:", insertResult);
		return null;
	}
	
	const newRowId = insertResult.meta.last_row_id;
	
	const { results } = await db.prepare(
		`SELECT * FROM tb_group WHERE ROWID = ?`
	).bind(newRowId).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function insertUndangan(db, data) {
	const insertResult = await db.prepare(
		`INSERT INTO tb_undangan (
			id_acara,
			id_subgroup
		) VALUES (?, ?)`
	).bind(
		parseInt(data.idAcara),
		parseInt(data.idSubGroup)
	).run();
	
	if (!insertResult.success || insertResult.meta.last_row_id === undefined) {
		console.error("Gagal melakukan INSERT undangan:", insertResult);
		return null;
	}
	
	const newRowId = insertResult.meta.last_row_id;
	
	const { results } = await db.prepare(
		`SELECT 
			tb_undangan.*, 
			tb_subgroup.nama_subgroup,
			tb_group.nama_group
		FROM tb_undangan
		JOIN tb_subgroup ON tb_undangan.id_subgroup = tb_subgroup.id_subgroup
		JOIN tb_group ON tb_subgroup.id_group = tb_group.id_group
		WHERE tb_undangan.ROWID = ?`
	).bind(newRowId).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function insertAcara(db, data) {
	const insertResult = await db.prepare(
		`INSERT INTO tb_acara (
			nama_acara,
			tanggal,
			jam,
			lokasi,
			latitude,
			longitude,
			radius,
			jml_peserta
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	).bind(
		data.namaAcara,
		data.tanggal,
		data.jamMulai,
		data.lokasi,
		data.latitude,
		data.longitude,
		data.radius,
		data.jmlPeserta
	).run();
	
	if (!insertResult.success || insertResult.meta.last_row_id === undefined) {
		console.error("Gagal melakukan INSERT acara:", insertResult);
		throw new Error("Gagal menyimpan data acara baru ke database.");
	}
	
	const newRowId = insertResult.meta.last_row_id;
	
	// Mengambil kembali baris yang baru dibuat menggunakan ROWID untuk mendapatkan id_acara
	const { results } = await db.prepare(
		`SELECT * FROM tb_acara WHERE ROWID = ?`
	).bind(newRowId).all();
	
	return results.length > 0 ? results[0] : null;
}

export async function getStatistik(db, idAcara) {
	const id = parseInt(idAcara);
	 
	const [undanganResult, countResult, hadirResult, genderResult, jenisKepegawaianResult] = await Promise.all([
		// Ambil data undangan (total subGroup)
		db.prepare(`
			SELECT DISTINCT tb_subgroup.id_subgroup, tb_subgroup.nama_subgroup, tb_subgroup.id_group, tb_group.nama_group
			FROM tb_undangan
			JOIN tb_subgroup ON tb_undangan.id_subgroup = tb_subgroup.id_subgroup
			JOIN tb_group ON tb_subgroup.id_group = tb_group.id_group
			WHERE tb_undangan.id_acara = ?
		`).bind(id).all(),
		
		// Hitung jml peserta Hadir
		db.prepare(
			"SELECT COUNT(id_presensi) AS jmlPesertaHadir FROM tb_presensi WHERE id_acara = ?"
		).bind(id).all(),
		
		// Ambil list subgroup yang sudah hadir
		db.prepare(`
			SELECT DISTINCT tb_subgroup.nama_subgroup
			FROM tb_presensi
			JOIN tb_subgroup ON tb_presensi.id_subgroup = tb_subgroup.id_subgroup
			WHERE tb_presensi.id_acara = ?
		`).bind(id).all(),
		
		// Ambil semua gender
		db.prepare(`SELECT * FROM tb_gender`).all(),
		
		// Ambil semua jenis kepegawaian
		db.prepare(`SELECT * FROM tb_jenis_kepegawaian`).all()
	]);
	
	const undanganDetails = undanganResult.results || [];
	const jmlPesertaHadir = countResult.results[0]?.jmlPesertaHadir || 0;
	const subGroupHadirRows = hadirResult.results || [];
	const allGender = genderResult.results || [];
	const allJenisKepegawaian = jenisKepegawaianResult.results || [];
	
	// Lanjutkan pengolahan di JS
	const subGroupHadirNames = subGroupHadirRows.map(row => row.nama_subgroup);
	
	// Hitung subgroup yang belum hadir
	const subGroupBelumHadirDetails = undanganDetails.filter(
		item => !subGroupHadirNames.includes(item.nama_subgroup)
	);
	
	return {
		jmlPesertaHadir: jmlPesertaHadir,
		jmlSubGroup: undanganDetails.length,
		jmlSubGroupHadir: subGroupHadirNames.length,
		subGroupHadir: subGroupHadirNames,
		subGroup: undanganDetails,
		subGroupBelumHadir: subGroupBelumHadirDetails,
		gender: allGender,
		jenisKepegawaian: allJenisKepegawaian
	};
}
 
export async function getAdminByUsername(db, username) {
	const { results } = await db.prepare(
		"SELECT * FROM tb_admin WHERE username = ? AND status_admin = 'aktif'"
	).bind(username).all();

	return results.length > 0 ? results[0] : null;
}