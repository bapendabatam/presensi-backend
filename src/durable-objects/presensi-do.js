// presensi-backend/src/durable-objects/presensi-do.js

import * as db from '../db/queries.js';

export class Presensi {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		
		// --- STATE CACHE ---
		this.sessions = [];
		this.idAcara = null;
		this.acaraDetails = null;
		
		// Cache Statistik (diupdate secara realtime di memori)
		this.currentStats = {
			jmlPesertaHadir: 0,
			jmlSubGroupHadir: 0,
			subGroupHadir: [],
			subGroupBelumHadir: [],
		};
		
		// Data undangan (jarang berubah)
		this.undanganDetails = [];
		
		// Flag penanda apakah data awal sudah dimuat dari db
		this.isInitialized = false;
	}
	
	// Method helper utk mengambil data awal dari db (hanya jalan sekali)
	async initializeData() {
		if (this.isInitialized) return;
		
		try {
			// Ambil semua data dari db secara paralel
			const [acara, stats] = await Promise.all([
				db.getAcara(this.env.DB_PRESENSI, this.idAcara),
				db.getStatistik(this.env.DB_PRESENSI, this.idAcara)
			]);
			
			this.acaraDetails = acara;
			this.undanganDetails = stats.subGroup || []; // Simpan raw data undangan
			
			// Isi cache statistik awal
			this.currentStats = {
				jmlPesertaHadir: stats.jmlPesertaHadir || 0,
				jmlSubGroupHadir: stats.jmlSubGroupHadir || 0,
				subGroupHadir: stats.subGroupHadir || [],
				subGroupBelumHadir: stats.subGroupBelumHadir || []
			};
			
			this.isInitialized = true;
			console.log(`DO Initialized for Acara ID: ${this.idAcara}`);
		} catch (e) {
			console.error("Failed to initialize DO data:", e);
		}
	}
	
	async fetch(request) {
		const url = new URL(request.url);
		
		// === Jalur internal HTTP POST (Signal dari Worker - Presensi Baru Masuk) ===
		if (url.pathname === "/signal-new-entry" && request.method === 'POST') {
			try {
				const newPresensiEntry = await request.json();
				console.log("DO LOG: Sinyal POST diterima. ENTRY BERHASIL DIPROSES!");
				
				// Logika penting: Pastikan data sudah diinisiasi sebelum update
				if (!this.isInitialized) {
					// Jika data belum sempat diinisiasi, panggil ulang (ini terjadi jika sinyal datang sebelum WS)
					// Ini akan mem-block concurrency sampai data siap
					await this.state.blockConcurrencyWhile(async () => {
						if (!this.isInitialized) {
							// Ambil ID Acara dari NewEntry jika this.idAcara masih null
							this.idAcara = this.idAcara || newPresensiEntry.idAcara; 
							await this.initializeData();
						}
					});
				}
				
				// Update cache dan broadcast (tanpa query db)
				await this.updateAndBroadcast(newPresensiEntry);
				return new Response("Signal received", { status: 200 });
			} catch (e) {
				console.error("DO ERROR: Gagal memproses sinyal internal:", e);
				return new Response("Internal signal error", { status: 500 });
			}
		}
		// === END OF Jalur internal HTTP POST (Signal dari Worker - Presensi Baru Masuk) ===
		
		// === Jalur internal HTTP POST (Signal dari Worker - Tambah acara baru) ===
		if (url.pathname === "/signal-new-acara" && request.method === 'POST') {
			if (this.idAcara !== 'all') {
				return new Response("Signal new acara hanya berlaku untuk ID 'all'", { status: 400 });
			}
			
			try {
				const newAcara = await request.json();
				console.log(`DO [${this.idAcara}]: Menerima sinyal acara baru: ${newAcara.id_acara}`);
				
				this.broadcast(JSON.stringify({
					type: 'realtime_update_acara',
					new_acara: newAcara,
				}));
				
				return new Response("Sinyal new acara berhasil diproses", { status: 200 });
			} catch (e) {
				console.error(`DO [${this.idAcara}]: Gagal memproses sinyal acara baru:`, e);
				return new Response(`Error: ${e.message}`, { status: 500 });
			}
		}
		// === END OF Jalur internal HTTP POST (Signal dari Worker - Tambah acara baru) ===
		
		// === Jalur internal HTTP POST (Signal dari Worker - Undangan Baru Ditambahkan) ===
		if (url.pathname === "/signal-new-undangan" && request.method === 'POST') {
			try {
				// newUndanganEntry adalah data subgroup yang baru ditambahkan ke acara
				const newUndanganEntry = await request.json(); 
				console.log("DO LOG: Sinyal POST diterima. UNDANGAN BARU BERHASIL DIPROSES!");
		
				// Panggil fungsi untuk update cache data undangan dan broadcast
				await this.updateUndanganAndBroadcast(newUndanganEntry);
				
				return new Response("Signal received", { status: 200 });
			} catch (e) {
				console.error("DO ERROR: Gagal memproses sinyal internal undangan:", e);
				return new Response("Internal signal error", { status: 500 });
			}
		}
		// === END OF Jalur internal HTTP POST (Signal dari Worker - Undangan Baru Ditambahkan) ===
		
		const currentIdAcara = url.searchParams.get('acara');
		
		// Validasi parameter ID Acara
		if (!currentIdAcara) {
			// Tolak jika parameter tidak ada
			if (url.pathname === "/signal-new-entry" || request.headers.get("Upgrade") === "websocket") {
				return new Response("Parameter 'acara' wajib ada.", { status: 400 });
			}
		}
		
		// Inisiasi ID Acara DO (Binding)
		if (this.idAcara === null) {
			this.idAcara = currentIdAcara;
			// Pastikan data ter-load sebelum memproses request apapun
			// blockConcurrencyWhile menahan request lain sampai promise selesai
			this.state.blockConcurrencyWhile(async () => {
				await this.initializeData();
			});
		} else if (this.idAcara !== currentIdAcara) {
			return new Response("DO bound to different event ID.", { status: 409 });
		}
		
		// Jalur WebSocket
		if (request.headers.get("Upgrade") === "websocket") {
			// Ambil payload otorisasi dari header internal (dikirim oleh worker utama)
			const adminPayloadHeader = request.headers.get('X-Admin-Payload');
			let adminPayload = null;
			
			if (adminPayloadHeader) {
				try {
					adminPayload = JSON.parse(adminPayloadHeader);
				} catch (e) {
					return new Response("Invalid auth payload", { status: 400 });
				}
			} else {
				return new Response("Auth header missing", { status: 401 });
			}
			
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			
			await this.handleSession(server, adminPayload);
			
			return new Response(null, { status: 101, webSocket: client });
		}
		
		return new Response("Not Found", { status: 404 });
	}
	
	// Mengelola sesi WebSocket baru: validasi acara, inisiasi, penanganan event
	async handleSession(webSocket, adminPayload) {
		// Double check initialization
		if (!this.isInitialized) await this.initializeData();
		
		webSocket.accept();
		
		// Tambahkan sesi dengan properti role utk filteriing broadcast
		const session = {
			webSocket,
			role: adminPayload.role
		};
		this.sessions.push(session);
		
		// Siapkan data statistik utk dikirim (initial state)
		const statsData = {
			jmlPesertaHadir: this.currentStats.jmlPesertaHadir,
			jmlSubGroupHadir: this.currentStats.jmlSubGroupHadir,
			jmlSubGroup: this.undanganDetails.length,
			subGroupBelumHadir: this.currentStats.subGroupBelumHadir
		};
		
		// Kirim initial stats ke client, baik admin ataupun guest
		webSocket.send(JSON.stringify({
			type: "initial_stats",
			data: statsData,
			acara: this.acaraDetails,
			timestamp: Date.now()
		}));
		
		// --- Event Listeners ---
		// Atur event handler untuk setiap sesi
		webSocket.addEventListener('close', () => {
			// Hapus sesi dari list saat koneksi terputus
			this.sessions = this.sessions.filter(s => s.webSocket !== webSocket);
			console.log(`Session closed untuk ID Acara: ${this.idAcara}. Total aktif: ${this.sessions.length}`);
		});
		
		webSocket.addEventListener('error', (err) => {
			// Hapus sesi
			this.sessions = this.sessions.filter(s => s.webSocket !== webSocket);
			console.error(`WebSocket error untuk ID Acara: ${this.idAcara}:`, err);
		});
		
		// Handler untuk pesan masuk dari dashboard
		webSocket.addEventListener('message', async (event) => {
			const message = JSON.parse(event.data);
			
			// Cek otorisasi: apakah user ini admin/super?
			const isAuthorizedAdmin = ['admin', 'super'].includes(adminPayload.role);
			
			// Handler khusus permintaan data detail presensi (hanya admin)
			if (message.type === 'get_data_presensi') {
				// ABAIKAN jika bukan admin
				if (!isAuthorizedAdmin) return;
				
				try {
					const dataPresensi = await db.getDataPresensi(this.env.DB_PRESENSI, this.idAcara);
					webSocket.send(JSON.stringify({
						type: "data_presensi",
						results: dataPresensi
					}));
				} catch (error) {
					console.error("Error fetching data presensi:", error);
				}
			}
			
			// Handler khusus permintaan data acara (hanya admin)
			if (message.type === 'get_data_acara') {
				// ABAIKAN jika bukan admin
				if (!isAuthorizedAdmin) return;
				
				try {
					const dataAcara = await db.getDataAcara(this.env.DB_PRESENSI);
					webSocket.send(JSON.stringify({
						type: "data_acara",
						results: dataAcara
					}));
				} catch (error) {
					console.error("Error fetching data acara:", error);
				}
			}
			
			// Handler khusus permintaan data undangan (hanya admin)
			if (message.type === 'get_data_undangan') {
				// ABAIKAN jika bukan admin
				if (!isAuthorizedAdmin) return;
				
				try {
					const dataUndangan = await db.getDataUndangan(this.env.DB_PRESENSI, this.idAcara);
					webSocket.send(JSON.stringify({
						type: "data_undangan",
						results: dataUndangan
					}));
				} catch (error) {
					console.error("Error fetching data undangan:", error);
				}
			}
		});
	}
	
	broadcast(message) {
		const payload = typeof message === 'string' ? message : JSON.stringify(message);
		
		// Gunakan filter utk hapus sesi yg putus.
		this.sessions = this.sessions.filter(session => {
			try {
				session.webSocket.send(payload);
				return true; // Sesi aktif
			} catch (e) {
				console.warn("Gagal mengirim pesan, sesi mungkin sudah habis. Menghapus sesi.");
				// Coba tutup secara paksa jika masih terbuka
				try {
					session.webSocket.close(1011, "Koneksi terputus.");
				} catch (e) { /* ignore */}
				return false; // Sesi putus, hapus.
			}
		});
	}
	
	// Update cache dan broadcast (HANYA UNTUK ENTRY PRESENSI)
	async updateAndBroadcast(newEntry) {
		if (!newEntry) return;
		console.log(`DO LOG: Mulai Broadcast. Total sesi aktif: ${this.sessions.length}`);
		
		// Update cache Statistik
		this.currentStats.jmlPesertaHadir++;
		
		// Cek apakah ini subGroup yang baru pertama kali hadir
		const namaSubGroup = newEntry.nama_subgroup;
		
		// Jika nama subgroup belum ada di list 'yang sudah hadir'
		if (!this.currentStats.subGroupHadir.includes(namaSubGroup)) {
			// Tambahkan ke list hadir
			this.currentStats.subGroupHadir.push(namaSubGroup);
			this.currentStats.jmlSubGroupHadir++;
			
			// Update list 'belum hadir' dengan memfilter ulang dari master undangan
			this.currentStats.subGroupBelumHadir = this.undanganDetails.filter(
				item => !this.currentStats.subGroupHadir.includes(item.nama_subgroup)
			);
		}
		
		// Siapkan pesan broadcast
		const broadcastMessage = JSON.stringify({
			type: "realtime_update",
			data: this.currentStats,
			new_entry: newEntry,
		});
		
		// Broadcast ke semua sesi aktif (admin dan guest)
		this.broadcast(broadcastMessage);
	}
	
	// Broadcast data undangan baru
	async updateUndanganAndBroadcast(newEntry) {
		if (!newEntry) return;
	
		// Update Cache Undangan: Tambahkan entri baru ke daftar master undangan
		this.undanganDetails.push(newEntry);
	
		// Update Cache Statistik: Tambahkan ke subGroupBelumHadir
		// Karena ini adalah undangan baru, secara otomatis dia belum hadir
		this.currentStats.subGroupBelumHadir.push(newEntry);
	
		// Update Jumlah Total SubGroup yang Diundang
		// Hitung ulang unik nama_subgroup dari undanganDetails
		const uniqueSubGroups = new Set(this.undanganDetails.map(item => item.nama_subgroup).filter(Boolean));
		const newTotalSubGroup = uniqueSubGroups.size;
	
		// Siapkan data statistik baru
		const updatedStats = {
			// Daya yg berubah karena undangan baru
			jmlSubGroup: newTotalSubGroup,
			subGroupBelumHadir: this.currentStats.subGroupBelumHadir,
			
			// Data yg tidak berubah (diambil dari cache)
			jmlPesertaHadir: this.currentStats.jmlPesertaHadir,
			jmlSubGroupHadir: this.currentStats.jmlSubGroupHadir,
		};
	
		// Siapkan pesan broadcast
		const broadcastMessage = JSON.stringify({
			type: "realtime_update_undangan",
			
			// Ini berisi semua statistik yang dibutuhkan publik/admin.
			data: updatedStats,
			
			// Ini berisi detail entri baru utk mengisi tabel di halaman admin/data-undangan
			new_entry: newEntry,
		});
	
		// Broadcast ke semua sesi aktif (khusus admin)
		// Di sini kita broadcast ke semua sesi, lalu filter di frontend jika perlu.
		this.broadcast(broadcastMessage);
	}
}