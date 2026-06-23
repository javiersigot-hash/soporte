from flask import Flask, jsonify, request, send_from_directory
import sqlite3
import os
from werkzeug.utils import secure_filename
import time

app = Flask(__name__, static_folder='static', template_folder='templates')
DB_PATH = 'soporte.db'
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Asegurarse de que la carpeta de subidas existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    if not os.path.exists(DB_PATH):
        conn = get_db_connection()
        conn.execute('''
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT UNIQUE NOT NULL,
                contenido TEXT
            )
        ''')
        clientes_iniciales = ["012-ACSA", "028-AACC", "029-ASSA", "051-ABSA", "058-PANEDILE", "060-CESOP"]
        for c in clientes_iniciales:
            slug = c.lower().split('-')[1] if '-' in c else c.lower()
            plantilla = f'''<h3>Datos de Instalación: <span style="color:#1A73E8">{c}</span></h3>
<p style="color: #666; margin-bottom: 15px; font-size: 12px;">Haz clic aquí para editar. Puedes pegar archivos (Ctrl+V) o usar el botón de adjuntar.</p>
<div class="editable-area" contenteditable="true">
    <b>IP Servidor:</b> 192.168.X.X<br>
    <b>URL Acceso:</b> https://{slug}.clinkgo.com<br>
    <b>Notas Adicionales:</b> <br><br>
</div>'''
            conn.execute('INSERT INTO clientes (codigo, contenido) VALUES (?, ?)', (c, plantilla))
        conn.commit()
        conn.close()

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

# --- NUEVO: RUTA PARA SUBIR ARCHIVOS (.zip, .ovpn, .txt, imagenes) ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        # Generar un nombre seguro y único para no sobreescribir archivos
        original_filename = secure_filename(file.filename)
        timestamp = str(int(time.time()))
        filename = f"{timestamp}_{original_filename}"
        
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        url = f"/uploads/{filename}"
        return jsonify({'url': url, 'filename': original_filename, 'saved_name': filename}), 201

# --- NUEVO: RUTA PARA DESCARGAR/VER ARCHIVOS SUBIDOS ---
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# (Rutas de clientes anteriores simplificadas por espacio)
@app.route('/api/clientes', methods=['GET', 'POST'])
def handle_clientes():
    if request.method == 'GET':
        conn = get_db_connection()
        rows = conn.execute('SELECT * FROM clientes').fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])
    else:
        data = request.json
        codigo = data.get('codigo')
        plantilla = f'<h3>Datos: <span style="color:#1A73E8">{codigo}</span></h3><div class="editable-area" contenteditable="true"><br></div>'
        try:
            conn = get_db_connection()
            cursor = conn.execute('INSERT INTO clientes (codigo, contenido) VALUES (?, ?)', (codigo, plantilla))
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return jsonify({'id': new_id, 'codigo': codigo, 'contenido': plantilla}), 201
        except:
            return jsonify({'error': 'Error guardando'}), 400

@app.route('/api/clientes/<int:id>', methods=['PUT', 'DELETE'])
def update_cliente(id):
    conn = get_db_connection()
    if request.method == 'DELETE':
        conn.execute('DELETE FROM clientes WHERE id = ?', (id,))
    else:
        data = request.json
        if 'codigo' in data:
            conn.execute('UPDATE clientes SET codigo = ? WHERE id = ?', (data['codigo'], id))
        if 'contenido' in data:
            conn.execute('UPDATE clientes SET contenido = ? WHERE id = ?', (data['contenido'], id))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})

if __name__ == '__main__':
    init_db()
    print("Servidor ClinkGO con Archivos corriendo en http://localhost:5000")
    app.run(debug=True, port=5000)
