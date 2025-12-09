// presensi-backend/src/index.js

import { Presensi } from './durable-objects/presensi-do.js';
import * as db from './db/queries.js';
import { verifyPassword, signJWT, verifyToken } from './utils/auth.js';

export { Presensi };

const ORIGIN_FRONTEND = 'https://192.168.0.20:8788';
//const ORIGIN_FRONTEND = 'https://192.168.101.72:8788';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': ORIGIN_FRONTEND,
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Allow-Credentials': 'true',
};

// Fungsi helper untuk membuat Response JSON dengan Header CORS
function buildResponse(data, status = 200, extraHeaders = {}, contentType = 'application/json') {
	const headers = {
		'Content-Type': contentType,
		...CORS_HEADERS,
		...extraHeaders,
	};
	return new Response(JSON.stringify(data), { status, headers });
}

const ADMIN_PAGES = [
	'/admin/data-presensi',
	'/admin/data-undangan',
	'/admin/kelola-acara',
	'/admin/dashboard',
];

function isRequestingAdminPage(pathname) {
	console.log("isRequestingAdminPage is called");
	let cleanPath = pathname.endsWith('.html') ? pathname.substring(0, pathname.length - 5) : pathname;
	cleanPath = cleanPath.replace(/\/$/, '');
	
	console.log(ADMIN_PAGES.includes(cleanPath));
	return ADMIN_PAGES.includes(cleanPath);
}

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const idAcara = url.searchParams.get('acara');

		// Helper utk memverifikasi token dan mengembalikan response 401
		async function authenticateRequest(request, env) {
			// Ambil token dari Authorization header
			let token = request.headers.get('Authorization')?.replace('Bearer ', '');
			
			// Jika tidak ada di header, coba ambil dari cookie (ini penting untuk browser)
			if (!token) {
				const cookieHeader = request.headers.get('Cookie');
				if (cookieHeader) {
					const cookies = cookieHeader.split(';').map(c => c.trim());
					const adminCookie = cookies.find(c => c.startsWith('admin_token='));
					if (adminCookie) {
						token = adminCookie.substring('admin_token='.length);
					}
				}
			}
			
			if (!token) {
				return buildResponse({ error: "Unauthorized access. Missing authentication token." }, 401);
			}
			
			// Verifikasi token
			const payload = await verifyToken(token, env.JWT_SECRET);
			
			const ALLOWED_API_ROLES = ['admin', 'super'];
			
			if (!payload || !ALLOWED_API_ROLES.includes(payload.role)) {
				return buildResponse({ error: "Unauthorized access. Invalid or missing admin token." }, 401);
			}
			return payload; // Mengembalikan payload jika sukses
		}

		// === WAJIB: TANGANI PERMINTAAN OPTIONS (PREFLIGHT) ===
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204, 
				headers: CORS_HEADERS 
			});
        }
		
		// === MIDDLEWARE AUTHENTICATION DAN REDIRECT ===
		const currentPathname = url.pathname;
		const LOGIN_PAGE = '/admin/login';
		
		if (isRequestingAdminPage(currentPathname)) {
			console.log('HELLO');
			// Coba otentikasi tanpa mengembalikan 401 response, hanya mendapatkan payload/null
			let token = request.headers.get('Authorization')?.replace('Bearer ', '');
			const cookieHeader = request.headers.get('Cookie');
			
			if (!token && cookieHeader) {
				// Ambil token dari cookie
				const cookies = cookieHeader.split(';').map(c => c.trim());
				const adminCookie = cookies.find(c => c.startsWith('admin_token='));
				
				if (adminCookie) {
					token = adminCookie.substring('admin_token='.length);
				}
			}
			
			let isAuthenticated = false;
			if (token) {
				const payload = await verifyToken(token, env.JWT_SECRET).catch(() => null);
				if (payload && ['admin', 'super'].includes(payload.role)) {
					isAuthenticated = true;
				}
			}
			
			if (!isAuthenticated) {
				// Pengguna tidak terotentikasi, redirect dgn referer
				console.log(`REDIRECT: User tidak terotentikasi di ${currentPathname}. Redirect ke login.`);
				
				// Tangkap URL lengkap yg diminta pengguna (termasuk query params seperti ?acara=1)
				const originPath = url.pathname + url.search;
				
				// Buat URL redirect: /login/?redirect=/data-presensi/?acara=1
				const finalRedirect = LOGIN_PAGE + `?redirect=${encodeURIComponent(originPath)}`;
				
				const redirectURL = ORIGIN_FRONTEND + finalRedirect;
				
				console.log(`[WORKER DEBUG] Redirecting to: ${redirectURL}`);
				
				// Kirim 302 redirect ke client
				return Response.redirect(redirectURL, 302);
			}
		}
		// === END MIDDLEWARE ===
		
		// === ENDPOINT VERIFY SESSION ===
		if (url.pathname === "/api/auth/verify-session" && request.method === 'GET') {
			
			// Mengambil token dari Cookie
			const cookieHeader = request.headers.get('Cookie');
			let token = null;

			if (cookieHeader) {
				// Parsing cookie untuk mendapatkan admin_token
				const cookies = cookieHeader.split(';').map(c => c.trim());
				const adminCookie = cookies.find(c => c.startsWith('admin_token='));
				if (adminCookie) {
					token = adminCookie.substring('admin_token='.length);
				}
			}

			if (!token) {
				// Token tidak ditemukan di Cookie
				console.log("VERIFY SESSION: Token tidak ditemukan di cookie.");
				return buildResponse({ error: "No session token found." }, 401);
			}

			// Memverifikasi token
			const payload = await verifyToken(token, env.JWT_SECRET);

			const ALLOWED_ROLES = ['admin', 'super'];

			if (!payload || !ALLOWED_ROLES.includes(payload.role)) {
				// Token tidak valid (expired atau signature salah) atau role tidak diizinkan
				console.log(`VERIFY SESSION: Token tidak valid/expired. Role: ${payload?.role}`);
				return buildResponse({ error: "Invalid or expired session." }, 401);
			}
			
			// Jika valid, kembalikan 200 OK beserta payload user
			return buildResponse({ 
				message: "Session valid.", 
				user: {
					username: payload.username,
					role: payload.role
				}
			}, 200);
		}
		
		// ===
		
		// === Jalur Login Admin ===
		else if (url.pathname === "/api/auth/login" && request.method === "POST") {
			try {
				
				const { username, password, redirect } = await request.json();
				
				if (!username || !password) {
					return buildResponse({ error: "Username dan Password wajib diisi." }, 400);
				}
				
				const admin = await db.getAdminByUsername(env.DB_PRESENSI, username);
				
				if (!admin) {
					// Return error generik untuk keamanan
					return buildResponse({ error: "Username atau Password salah." }, 401);
				}
				
				const isValid = await verifyPassword(admin.password_hash, password);
				
				// Verifikasi Password
				if (!isValid) {
					return buildResponse({ error: "Username atau Password salah." }, 401);
				}
				
				// Buat Token JWT
				// Di production, JWT_SECRET harus sudah disetting, caranya:
				// npx wrangler secret put JWT_SECRET
				// (Lalu paste kunci rahasia dan tekan Enter)
				const secret = env.JWT_SECRET;
				const token = await signJWT({ id: admin.id, username: admin.username, role: admin.type_admin }, env.JWT_SECRET);
				
				// Tentukan durasi Cookie (12 jam, sama dengan masa exp JWT)
				const MAX_AGE_SECONDS = 60 * 60 * 12;
				
				// Tentukan Nilai Cookie: HttpOnly dan Secure wajib!
				const cookieValue = `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
				
				// Tentukan path setelah login (default belum dibuat)
				const successPath = redirect || '/admin/dashboard'; 
				
				// Buat Response dengan Header Set-Cookie
				const headers = {
					'Content-Type': 'application/json',
					'Set-Cookie': cookieValue,
					...CORS_HEADERS,
				};
				
				return new Response(JSON.stringify({
					message: "Login berhasil.",
					redirect: successPath,
					user: {
						username: admin.username,
						role: admin.type_admin
					}
				}), { status: 200, headers });
			} catch (e) {
				console.error("Login error:", e);
				return buildResponse({ error: "Terjadi Kesalahan sistem." }, 500);
			}
		}
		
		// === Jalur Logout Admin ===
		else if (url.pathname === "/api/auth/logout" && request.method === "POST") {
			try {
				// Untuk menghapus cookie admin_token (HttpOnly), kita set cookie baru dengan Max-Age=0
				const expiredCookieValue = 'admin_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
				
				const headers = {
					'Content-Type': 'application/json',
					'Set-Cookie': expiredCookieValue,
					...CORS_HEADERS,
				};
				
				// Kirim respon sukses
				return new Response(JSON.stringify({
					message: "Logout berhasil. Token dihapus.",
				}), { status: 200, headers });
			} catch (e) {
				console.error("Logout error:", e);
				return buildResponse({ error: "Terjadi kesalahan sistem saat logout." }, 500);
			}
		}
		
		// === Jalur WebSocket ===
		else if (url.pathname === "/ws/") {
			// VERIFIKASI TOKEN UNTUK WebSocket
			// AMBIL TOKEN DARI HEADER COOKIE
			const cookieHeader = request.headers.get('Cookie');
			let tokenWs = null;
			let adminPayloadWs = null;
			
			if (cookieHeader) {
				// Parsing cookie untuk mendapatkan admin_token
				const cookies = cookieHeader.split(';').map(c => c.trim());
				const adminCookie = cookies.find(c => c.startsWith('admin_token='));
				if (adminCookie) {
					tokenWs = adminCookie.substring('admin_token='.length);
				}
			}
			
			if (tokenWs) {
				// LAKUKAN VERIFIKASI
				adminPayloadWs = await verifyToken(tokenWs, env.JWT_SECRET);
			}
			
			let payloadForDO;
			const ALLOWED_ADMIN_ROLES = ['admin', 'super'];
			
			if (adminPayloadWs && ALLOWED_ADMIN_ROLES.includes(adminPayloadWs.role)) {
				// Jika admin valid
				payloadForDO = adminPayloadWs;
			} else {
				// guest
				payloadForDO = { role: 'guest', username: 'public_dashboard' };
			}
			// -----

			if (!idAcara) {
				return Response.json({ error: "Parameter acara wajib disertakan."}, { status: 400 });
			}

			if (request.headers.get('Upgrade') !== 'websocket') {
				return new Response('Expected upgrade to WebSocket', { status: 426 });
			}

			const id = env.PRESENSI.idFromName(idAcara);
			const presensiDO = env.PRESENSI.get(id);
			
			const doRequest = new Request(request);
			doRequest.headers.set(
				'X-Admin-Payload',
				JSON.stringify(payloadForDO)
			);
			
			// Serahkan request ke Durable Object(DO). Pengecekan ID Acara di DB dilakukan oleh DO.
			return presensiDO.fetch(doRequest);
		}
		
		// === Jalur API Admin (HTTP GET) ===
		// Untuk admin/data-presensi
		else if (url.pathname === "/api/admin/data-presensi" && request.method === "GET") {
			// VERIFIKASI TOKEN
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			// --- END VERIFIKASI TOKEN
			
			if (!idAcara) {
				return buildResponse({ error: "Parameter acara wajib disertakan." }, 400);
			}
			
			const acaraDetails = await db.getAcara(env.DB_PRESENSI, idAcara);
			if (!acaraDetails) {
				return buildResponse({ error: "Acara tidak ditemukan." }, 404);
			}
			
			const dataPresensi = await db.getDataPresensi(env.DB_PRESENSI, idAcara);
			// SERTAKAN CORS HEADER PADA RESPON SUKSES
			return buildResponse(dataPresensi);
		}
		
		// admin/data-undangan
		else if (url.pathname === "/api/admin/data-undangan" && request.method === "GET") {
			// VERIFIKASI TOKEN
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			// --- END VERIFIKASI TOKEN
			
			if (!idAcara) {
				return buildResponse({ error: "Parameter acara wajib disertakan." }, 400);
			}
			
			const acaraDetails = await db.getAcara(env.DB_PRESENSI, idAcara);
			if (!acaraDetails) {
				return buildResponse({ error: "Acara tidak ditemukan." }, 404);
			}
			
			const dataUndangan = await db.getDataUndangan(env.DB_PRESENSI, idAcara);
			// SERTAKAN CORS HEADER PADA RESPON SUKSES
			return buildResponse(dataUndangan);
		}
		
		// Jalur utk menampilkan master data subgroup
		else if (url.pathname === "/api/admin/get-all-subgroups" && request.method === "GET") {
			// Hanya admin yg boleh
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			
			try {
				const uniqueSubgroups = await db.getAllSubgroups(env.DB_PRESENSI);
				return buildResponse({ results: uniqueSubgroups });
			} catch (e) {
				return buildResponse({ error: "Gagal mengambil daftar semua subgroup." }, 500);
			}
		}
		
		// Jalur Initial data form (HTTP GET)
		else if (url.pathname === "/api/get-initial-data" && request.method === "GET") {
			// Parameter 'acara' sudah diambil di awal fungsi fetch: const idAcara = url.searchParams.get('acara');
	
			if (!idAcara) {
				return buildResponse({ error: "Parameter 'acara' wajib ada." }, 400);
			}
	
			try {
				// Ambil Acara Details dan Statistik Awal secara paralel
				const [acaraDetails, initialStats] = await Promise.all([
					db.getAcara(env.DB_PRESENSI, idAcara),
					db.getStatistik(env.DB_PRESENSI, idAcara)
				]);
		
				if (!acaraDetails) {
					return buildResponse({ error: `Acara dengan ID ${idAcara} tidak ditemukan.` }, 404);
				}
		
				// Kembalikan detail acara dan statistik awal (termasuk list subGroup)
				return buildResponse({
					acara: acaraDetails,
					data: initialStats
				});
		
			} catch (e) {
				console.error("Error fetching initial data for form:", e);
				return buildResponse({ error: "Gagal mengambil data awal untuk form." }, 500);
			}
		}
		
		// Jalur API Input Presensi (HTTP POST)
		else if (url.pathname === "/api/input-presensi" && request.method === "POST") {
			const data = await request.json();
			const idAcaraPost = data.idAcara;
			
			if (!idAcaraPost) {
				return buildResponse({ error: "ID Acara wajib ada." }, 400);
			}
			
			try {
				// Simpan data ke db dan dapatkan entri yg baru dibuat
				const newPresensiEntry = await db.insertPresensi(env.DB_PRESENSI, data);
				
				if (newPresensiEntry) {
					// Beritahu Durable Object utk update statistik dan kirim data entri baru (broadcast)
					const id = env.PRESENSI.idFromName(idAcaraPost);
					const presensiDO = env.PRESENSI.get(id);
					
					try {
						await presensiDO.fetch("http://internal/signal-new-entry", {
							method: 'POST',
							body: JSON.stringify(newPresensiEntry),
						});
						console.log("WORKER LOG: Sinyal ke DO berhasil dikirim.");
					} catch (doFetchError) {
						console.error("WORKER ERROR: Gagal mengirim sinyal ke Durable Object:", doFetchError);
					}
				}
				
				// SERTAKAN CORS HEADER PADA RESPON SUKSES
				return buildResponse({ 
					message: "Presensi berhasil disimpan.",
					id_presensi: newPresensiEntry.id_presensi,
					nama_acara: newPresensiEntry.nama_acara,
					nama: newPresensiEntry.nama,
					nama_subgroup: newPresensiEntry.nama_subgroup
				});
			} catch (e) {
				console.error("Error saat memproses input presensi:", e);
				// Mengembalikan 500 dengan CORS Header yang benar
				return buildResponse({ error: "Kesalahan internal server saat menyimpan data." }, 500);
			}
		}
		
		// === Jalur API input acara (HTTP POST) ===
		else if (url.pathname === "/api/input-acara" && request.method === "POST") {
			// Verifikasi token admin
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			
			const data = await request.json();
			try {
				const newAcaraEntry = await db.insertAcara(env.DB_PRESENSI, data);
				if (newAcaraEntry) {
					// Beritahu Durable Object utk update list acara di halaman kelola-acara.
					const idAll = env.PRESENSI.idFromName('all');
					const presensiDoAll = env.PRESENSI.get(idAll);
					
					try {
						// Signal khusus new acara
						await presensiDoAll.fetch("http://internal/signal-new-acara", {
							method: 'POST',
							body: JSON.stringify(newAcaraEntry),
						});
						console.log("WORKER LOG: Sinyal acara baru ke DO 'all' berhasil dikirim.");
					} catch (doFetchError) {
						console.error("WORKER ERROR: Gagal mengirim sinyal acara baru ke Durable Object:", doFetchError);
					}
				}
				
				return buildResponse({ message: "Acara berhasil ditambahkan dan pembaruan realtime dikirim.", acara: newAcaraEntry }, 201);
			} catch (e) {
				console.error("Error saat memproses input acara:", e);
				return buildResponse({ error: "Gagal menyimpan acara. Kesalahan internal server." }, 500);
			}
			
		}
		
		// === Jalur API input subgroup/group (HTTP POST) ===
		else if (url.pathname === "/api/admin/input-subgroup-group" && request.method === "POST") {
			// Verifikasi token admin
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			
			const { namaSubGroup, namaGroup } = await request.json();
			if (!namaSubGroup || !namaGroup) {
				return buildResponse({ error: "Nama Subgroup dan Nama Group wajib diisi." }, 400);
			}
			
			try {
				let groupId;
				let groupEntry;
				
				// Cari atau buat group baru
				const existingGroup = await db.getGroup(env.DB_PRESENSI, { namaGroup });
				
				if (existingGroup.length > 0) {
					groupEntry = existingGroup[0];
					groupId = groupEntry.id_group;
				} else {
					groupEntry = await db.insertGroup(env.DB_PRESENSI, { namaGroup });
					if (!groupEntry) {
						throw new Error("Gagal insert Group baru.");
					}
					groupId = groupEntry.id_group;
					console.log(`[DB LOG] Group baru dibuat: ID ${groupId}`);
				}
				
				// Cari atau buat subgroup baru
				let subGroupEntry;
				
				const existingSubGroup = await db.getSubGroup(env.DB_PRESENSI, { 
					namaSubGroup, 
					idGroup: groupId
				});
				
				if (existingSubGroup) {
					// Subgroup sudah ada, gunakan yg sudah ada
					subGroupEntry = existingSubGroup;
					console.log(`[DB LOG] Subgroup sudah ada: ID ${subGroupEntry.id_subgroup}`);
				} else {
					// Subgroup belum ada, insert baru
					const dataToInsert = { namaSubGroup, idGroup: groupId };
					subGroupEntry = await db.insertSubGroup(env.DB_PRESENSI, dataToInsert);
					
					if (!subGroupEntry) {
						throw new Error("Gagal insert Subgroup baru.");
					}
					console.log(`[DB LOG] Subgroup baru dibuat: ID ${subGroupEntry.id_subgroup}`);
					
					// Beritahu DO utk update daftar master
					const idAll = env.PRESENSI.idFromName('all');
					const presensiDoAll = env.PRESENSI.get(idAll);
					
					await presensiDoAll.fetch("http://internal/signal-new-subgroup", {
						method: 'POST',
						body: JSON.stringify(subGroupEntry),
					}).catch(e => console.error("WORKER ERROR: Gagal mengirim sinyal subgroup baru ke DO:", e));
				}
				
				// Kembalikan ID subgroup yg valid (baru atau lama)
				return buildResponse({
					message: "Subgroup dan Group berhasil diproses.",
					idSubGroup: subGroupEntry.id_subgroup,
					namaSubGroup: namaSubGroup,
					namaGroup: groupEntry.nama_group
				}, 201);
			} catch (e) {
				console.error("Error saat memproses input subgroup/group:", e);
				return buildResponse({ error: "Gagal menyimpan subgroup/group. Kesalahan internal server." }, 500);
			}
		}
		
		// === Jalur API input data undangan (HTTP POST) ===
		else if (url.pathname === "/api/input-undangan" && request.method === "POST") {
			// Verifikasi token admin
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			
			const data = await request.json();
			const idAcaraPost = data.idAcara;
			
			if (!idAcaraPost) {
				return buildResponse({ error: "ID Acara wajib ada." }, 400);
			}
			
			try {
				const newUndanganEntry = await db.insertUndangan(env.DB_PRESENSI, data);
				if (newUndanganEntry) {
					// Beritahu Durable Object utk update list undangan di halaman data-undangan,
					// Juga update statistik dan list subgroup di dashboard.
					const id = env.PRESENSI.idFromName(idAcaraPost);
					const presensiDo = env.PRESENSI.get(id);
					
					try {
						// Signal khusus new undangan
						await presensiDo.fetch("http://internal/signal-new-undangan", {
							method: 'POST',
							body: JSON.stringify(newUndanganEntry),
						});
						console.log("WORKER LOG: Sinyal undangan baru ke DO berhasil dikirim.");
					} catch (doFetchError) {
						console.error("WORKER ERROR: Gagal mengirim sinyal undangan baru ke Durable Object:", doFetchError);
					}
				}
				
				return buildResponse({ message: "Undangan berhasil ditambahkan dan pembaruan realtime dikirim.", undangan: newUndanganEntry }, 201);
			} catch (e) {
				console.error("Error saat memproses input undangan:", e);
				return buildResponse({ error: "Gagal menyimpan undangan. Kesalahan internal server." }, 500);
			}
		}
		
		// === Jalur API import data undangan (HTTP POST) ===
		else if (url.pathname === "/api/import-undangan" && request.method === "POST") {
			// Verifikasi token admin
			const admin = await authenticateRequest(request, env);
			if (admin.status === 401) {
				return admin;
			}
			
			//let formData;
			//try {
			//	formData = await request.formData();
			//} catch (e) {
			//	console.error("Error parsing form data:", e);
			//	return buildResponse({ error: "Format file tidak valid (multipart/form-data)."}, 400);
			//}
			//
			//const fileExcel = formData.get('fileExcel'); // Ambil file (File/Blob)
			//const idAcaraPost = formData.get('idAcara'); // Ambil ID Acara (string)
			//
			//if (!idAcaraPost) {
			//	return buildResponse({ error: "ID Acara wajib ada." }, 400);
			//}
			//
			//// Pastikan file ada dan merupakan File/Blob (bukan null string)
			//if (!fileExcel || !(fileExcel instanceof File)) {
			//	return buildResponse({ error: "File excel wajib diupload." }, 400);
			//}
			//
			//try {
			//	// Ambil data biner (ArrayBuffer)
			//	const fileBuffer = await fileExcel.arrayBuffer();
			//} catch (e) {
			//	console.error("Error saat memproses import undangan:", e);
			//	return buildResponse({ error: "Gagal mengimport undangan. Kesalahan internal server." }, 500);
			//}
			
		}
		
		// Default 404
		return new Response("Not Found", { status: 404 });
	}
};
