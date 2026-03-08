// Minimal client-side logic to manage WhatsApp tab, QR, status, messages, and send form

const socket = io()
console.log('[ui] socket init')

const statusEl = document.getElementById('status-indicator')
const messagesEl = document.getElementById('messages')
const formEl = document.getElementById('send-form')
const numberEl = document.getElementById('number')
const textEl = document.getElementById('text')

// QR Modal elements
let qrModal = null
let qrModalImg = null

function setStatus(isReady) {
	if (isReady) {
		statusEl.textContent = 'Connected'
		statusEl.classList.remove('status-disconnected')
		statusEl.classList.add('status-connected')
		closeQrModal()
		return
	}
	statusEl.textContent = 'Disconnected'
	statusEl.classList.remove('status-connected')
	statusEl.classList.add('status-disconnected')
}

function createQrModal() {
	if (qrModal) return qrModal
	
	qrModal = document.createElement('div')
	qrModal.className = 'qr-modal'
	qrModal.innerHTML = `
		<div class="qr-modal-content">
			<h3>Scan QR Code</h3>
			<p>Open WhatsApp on your phone and scan this QR code to link your account</p>
			<img src="" alt="WhatsApp QR Code" style="display: none;">
			<div class="qr-loading" style="width: 280px; height: 280px; background: #f0f0f0; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
				<p>Loading QR Code...</p>
			</div>
			<button class="qr-modal-close">Close</button>
		</div>
	`
	
	qrModalImg = qrModal.querySelector('img')
	const closeBtn = qrModal.querySelector('.qr-modal-close')
	const loadingDiv = qrModal.querySelector('.qr-loading')
	
	closeBtn.addEventListener('click', closeQrModal)
	qrModal.addEventListener('click', (e) => {
		if (e.target === qrModal) closeQrModal()
	})
	
	document.body.appendChild(qrModal)
	return qrModal
}

function showQrModal(dataUrl) {
	createQrModal()
	if (dataUrl) {
		qrModalImg.src = dataUrl
		qrModalImg.style.display = 'block'
		qrModal.querySelector('.qr-loading').style.display = 'none'
	}
	qrModal.classList.add('show')
}

function closeQrModal() {
	if (qrModal) {
		qrModal.classList.remove('show')
		setTimeout(() => {
			if (qrModal && !qrModal.classList.contains('show')) {
				qrModal.remove()
				qrModal = null
				qrModalImg = null
			}
		}, 300)
	}
}

function appendMessage({ fromMe, body, from, to, timestamp, hasMedia, mediaInfo }) {
	const wrap = document.createElement('div')
	wrap.className = `msg ${fromMe ? 'me' : 'them'}`
	
	if (hasMedia && mediaInfo) {
		const mediaDiv = document.createElement('div')
		mediaDiv.className = 'media-message'
		
		if (mediaInfo.mimetype?.startsWith('image/')) {
			const img = document.createElement('img')
			img.src = `data:${mediaInfo.mimetype};base64,${mediaInfo.data}`
			img.alt = mediaInfo.filename
			img.style.maxWidth = '200px'
			img.style.maxHeight = '200px'
			img.style.borderRadius = '8px'
			mediaDiv.appendChild(img)
		} else {
			const fileDiv = document.createElement('div')
			fileDiv.className = 'file-message'
			fileDiv.innerHTML = `
				<div class="file-icon">📄</div>
				<div class="file-info">
					<div class="file-name">${mediaInfo.filename}</div>
					<div class="file-type">${mediaInfo.mimetype}</div>
				</div>
			`
			mediaDiv.appendChild(fileDiv)
		}
		
		if (body) {
			const captionDiv = document.createElement('div')
			captionDiv.className = 'media-caption'
			captionDiv.textContent = body
			mediaDiv.appendChild(captionDiv)
		}
		
		wrap.appendChild(mediaDiv)
	} else {
		wrap.textContent = body
	}
	
	messagesEl.appendChild(wrap)
	const meta = document.createElement('div')
	meta.className = 'meta'
	const who = fromMe ? `me → ${to || ''}` : `${from || ''} → me`
	meta.textContent = `${who} • ${new Date(timestamp || Date.now()).toLocaleTimeString()}`
	messagesEl.appendChild(meta)
	messagesEl.scrollTop = messagesEl.scrollHeight
}

// Socket events
socket.on('wa:status', ({ isReady }) => {
	console.log('[ui] status', isReady)
	setStatus(Boolean(isReady))
})

socket.on('wa:qr', ({ dataUrl }) => {
	console.log('[ui] qr event received')
	if (!dataUrl) return
	showQrModal(dataUrl)
})

socket.on('wa:authenticated', () => {
	console.log('[ui] authenticated')
	closeQrModal()
})

socket.on('wa:disconnected', () => {
	console.log('[ui] disconnected')
	setStatus(false)
})

socket.on('wa:message', msg => {
	appendMessage(msg)
})

socket.on('wa:history', list => {
	console.log('[ui] history', list?.length)
	messagesEl.innerHTML = ''
	;(list || []).forEach(m => appendMessage(m))
})

// Send form
formEl.addEventListener('submit', async e => {
	e.preventDefault()
	const number = numberEl.value.trim()
	const message = textEl.value.trim()
	if (!number || !message) return
	try {
		const res = await fetch('/api/send', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ number, message })
		})
		const data = await res.json()
		if (!data.ok) alert(data.error || 'Failed to send')
		else textEl.value = ''
	} catch (err) {
		alert('Network error')
	}
})


