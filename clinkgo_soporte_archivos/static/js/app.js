let clientesData = [];
let activeTabId = null;

const tabsHeader = document.getElementById('tabsHeader');
const tabContentArea = document.getElementById('tabContentArea');
const searchInput = document.getElementById('searchInput');
const btnAddTab = document.getElementById('btnAddTab');
const fileUploadInput = document.getElementById('fileUploadInput');
const btnAttachFile = document.getElementById('btnAttachFile');

async function loadClientes() {
    const res = await fetch('/api/clientes');
    clientesData = await res.json();
    renderTabs(searchInput.value.toLowerCase());
}

function renderTabs(filterTerm = '') {
    tabsHeader.innerHTML = '';
    tabContentArea.innerHTML = '';

    let filtered = clientesData;
    if (filterTerm) filtered = clientesData.filter(c => c.codigo.toLowerCase().includes(filterTerm) || c.contenido.toLowerCase().includes(filterTerm));
    if (filtered.length === 0) return;

    if (!activeTabId || !filtered.some(c => c.id === activeTabId)) activeTabId = filtered[0].id;

    filtered.forEach((cliente) => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${cliente.id === activeTabId ? 'active' : ''}`;
        btn.textContent = cliente.codigo;
        btn.onclick = () => {
            activeTabId = cliente.id;
            loadClientes(); // Reload simple para refrescar UI
        };
        tabsHeader.appendChild(btn);

        const contentDiv = document.createElement('div');
        contentDiv.className = `client-data-section ${cliente.id === activeTabId ? 'active' : ''}`;
        contentDiv.id = `content-${cliente.id}`;
        contentDiv.innerHTML = `
            <div id="editable-wrapper-${cliente.id}" style="display:contents;">${cliente.contenido}</div>
            <div class="action-bar">
                <button class="btn-save" onclick="saveContent(${cliente.id})"><i class="fa-solid fa-floppy-disk"></i> Guardar Cambios</button>
                <button class="btn-delete" onclick="deleteCliente(${cliente.id})">Eliminar Cliente</button>
            </div>
        `;
        tabContentArea.appendChild(contentDiv);
    });
}

async function saveContent(id) {
    const wrapper = document.getElementById(`editable-wrapper-${id}`);
    const htmlContenido = wrapper.innerHTML;
    await fetch(`/api/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: htmlContenido })
    });
    alert("Cambios guardados.");
}

// --- NUEVO: LÓGICA DE SUBIDA DE ARCHIVOS (PEGAR) ---
document.addEventListener('paste', async (e) => {
    // Verificar que estamos pegando dentro del area editable
    const editableArea = e.target.closest('.editable-area');
    if (!editableArea) return;

    const files = [];
    if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
            if (e.clipboardData.items[i].kind === 'file') {
                files.push(e.clipboardData.items[i].getAsFile());
            }
        }
    }

    if (files.length > 0) {
        e.preventDefault(); // Evitar que el navegador pegue en Base64 crudo
        await uploadFilesAndInsert(files);
    }
});

// --- NUEVO: LÓGICA DE SUBIDA DE ARCHIVOS (BOTÓN) ---
btnAttachFile.addEventListener('click', () => {
    fileUploadInput.click(); // Abre la ventana de Windows para elegir archivo
});

fileUploadInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        // Poner el foco en el area editable activa para saber dónde insertar
        const activeArea = document.querySelector('.client-data-section.active .editable-area');
        if (activeArea) activeArea.focus();
        
        await uploadFilesAndInsert(Array.from(e.target.files));
        fileUploadInput.value = ''; // Reset input
    }
});

// Función central para subir al servidor e insertar HTML en el texto
async function uploadFilesAndInsert(files) {
    for (let file of files) {
        const formData = new FormData();
        
        // Si pegamos una imagen de recortes, el navegador le pone 'image.png', cambiamos a algo único
        let fileName = file.name;
        if (fileName === 'image.png' || fileName === 'image.jpeg') {
            fileName = `captura_${Date.now()}.png`;
        }
        
        formData.append('file', file, fileName);

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (data.url) {
                let htmlToInsert = '';
                // Si es imagen, la mostramos; si es .zip, .ovpn, .txt, creamos un botón de descarga
                if (file.type.startsWith('image/')) {
                    htmlToInsert = `<img src="${data.url}" style="max-width:100%; max-height:400px; border-radius:5px; margin:10px 0; display:block;">`;
                } else {
                    htmlToInsert = `<a href="${data.url}" target="_blank" download="${data.filename}" class="file-link" contenteditable="false">
                                        <i class="fa-solid fa-file-arrow-down"></i> ${data.filename}
                                    </a>`;
                }
                
                // Inserta el código HTML justo donde está el cursor de texto
                document.execCommand("insertHTML", false, htmlToInsert + "&nbsp;");
            }
        } catch (err) {
            console.error("Error subiendo archivo:", err);
            alert("No se pudo subir " + fileName);
        }
    }
}

btnAddTab.addEventListener('click', async () => { /* logica anterior acortada */ });
searchInput.addEventListener('input', (e) => renderTabs(e.target.value.toLowerCase()));
window.addEventListener('DOMContentLoaded', loadClientes);
