// presensi-backend/src/utils/status.js

export function showStatus(type, message) {
	const statusDiv = document.getElementById("status");
	
	// Tentukan konten berdasarkan tipe
	let contentHtml = '';
	
	switch (type) {
		case 'loading':
			// Loading tidak perlu tombol close dan menggunakan loadingIcon
			contentHtml = `
				<div class="${type}">
					<div class="iconLoading"></div>
					<div class="statusText">${message}</div>
				</div>
			`;
			break;
			
		case 'warning':
			contentHtml = `
				<div class="${type}">
					<i class="statusIcon iconWarning fa-solid fa-circle-xmark"></i>
					<div class="statusText">${message}</div>
					<i class="close fa-solid fa-circle-xmark" onclick="closeStatus()"></i>
				</div>
			`;
			break;
		case 'success':
			contentHtml = `
				<div class="${type}">
					<i class="statusIcon iconSuccess fa-solid fa-circle-check"></i>
					<div class="statusText">${message}</div>
					<i class="close fa-solid fa-circle-xmark" onclick="closeStatus()"></i>
				</div>
			`;
			break;
			
		default:
			console.error("Tipe status tidak valid.");
			return;
	}
	
	// Tampilkan status container
	statusDiv.style.display = "flex"; 
	
	// Masukkan konten
	statusDiv.innerHTML = contentHtml;
}

export function cleanOnError(err) {
	showStatus('warning', err);
	document.getElementById("namaAcara").remove();
	document.getElementById("detailWrapper").remove();
	document.getElementById("wrapper").remove();
	
	return;
}

export function closeStatus() {
	document.getElementById("status").innerHTML = "";
	document.getElementById("status").style.display = "none";
}

window.closeStatus = closeStatus;