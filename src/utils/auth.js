// presensi-backend/src/utils/auth.js

// Mendekode Base64 ke ArrayBuffer (sama dengan Buffer.from(..., 'base64'))
function decodeBase64(b64) {
	const binString = atob(b64);
	const size = binString.length;
	const bytes = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		bytes[i] = binString.charCodeAt(i);
	}
	return bytes;
}

// Helper utk decode Base64 URL Safe ke string JSON
function decodeBase64UrlSafe(b64url) {
	let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
	
	while (b64.length % 4) {
		b64 += '=';
	}
	
	return decodeBase64(b64);
}

// Mengkodekan ArrayBuffer ke Base64 (digunakan oleh JWT))
function encodeBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	const binString = String.fromCodePoint(...bytes);
	// Menggunakan btoa, lalu membersihkan untuk URL Safe
	return btoa(binString).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Helper untuk mengimpor kunci HMAC
async function getHmacKey(secret, usage = "verify") { // Default usege = verify
	const enc = new TextEncoder();
	return crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		[usage]
	);
}
// ----------------------------------------------------

// Verifikasi password (PBKDF2)
// Format hash: PBKDF2:ALGO:ITERATIONS:SALT:hash
export async function verifyPassword(storedHashStr, inputPassword) {
	const parts = storedHashStr.split(':');
	if (parts.length !== 5) return false;
	
	const [type, algo, iterationsStr, saltB64, hashB64] = parts;
	const iterations = parseInt(iterationsStr);
	const salt = decodeBase64(saltB64);
	const originalHash = decodeBase64(hashB64);
	
	const enc = new TextEncoder();
	const passwordKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(inputPassword),
		{ name: "PBKDF2" },
		false,
		["deriveBits"]
	);
	
	// Turunkan bit dengan parameter yg SAMA PERSIS dengan saat pembuatan
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: iterations,
			hash: algo // SHA-256
		},
		passwordKey,
		originalHash.byteLength * 8 // Panjang bit yg sama
	);
	
	const derivedHash = new Uint8Array(derivedBits);
	
	// Lakukan Perbandingan (Timing Safe)
	// Harus memiliki panjang yang sama
	if (originalHash.length !== derivedHash.length) return false; 
	
	// Menggunakan crypto.subtle.timingSafeEqual untuk perbandingan yang aman
	return crypto.subtle.timingSafeEqual(originalHash, derivedHash);
}

/**
 * Verifikasi token JWT.
 * @param {string} token - Token JWT.
 * @param {string} secret - Kunci rahasia JWT.
 * @returns {Promise<object|false>} Payload token jika valid, atau false jika tidak valid.
 */
 export async function verifyToken(token, secret) {
	if (!token) return false;
	
	const parts = token.split('.');
	if (parts.length !== 3) return false;
	
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	
	try {
		const key = await getHmacKey(secret, "verify");
		
		const signatureBuffer = decodeBase64UrlSafe(encodedSignature);
		
		const isValid = await crypto.subtle.verify(
			"HMAC",
			key,
			signatureBuffer,
			new TextEncoder().encode(signingInput)
		);
		
		if (!isValid) return false;
		
		// Decode payload dan kembalikan
		const payloadJsonString = new TextDecoder().decode(decodeBase64UrlSafe(encodedPayload));
		const payload = JSON.parse(payloadJsonString);
		
		// Cek Expired (exp)
		if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
			return false;
		}
		
		return payload; // Token valid, kembalikan payload
	} catch (e) {
		console.error("Token verification error:", e);
		return false;
	}
 }

// JSON Web Token (JWT) sederhana
// Fungsi utk membuat token sesi
export async function signJWT(payload, secret) {
	const header = { alg: "HS256", typ: "JWT" };
	const enc = new TextEncoder();
	
	const encodedHeader = encodeBase64(enc.encode(JSON.stringify(header)));
	const encodedPayload = encodeBase64(enc.encode(JSON.stringify(payload)));
	
	const signingInput = `${encodedHeader}.${encodedPayload}`;
	
	const key = await getHmacKey(secret, "sign");
	
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		enc.encode(signingInput)
	);
	
	const encodedSignature = encodeBase64(signature);
	
	return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}