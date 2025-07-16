from flask import Flask, render_template, request, send_from_directory, url_for
from flask_socketio import SocketIO, emit, join_room
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/room', methods=['POST'])
def room():
    username = request.form['username']
    room = request.form['room']
    return render_template('room.html', username=username, room=room)

@app.route('/upload', methods=['POST'])
def upload():
    file = request.files['file']
    filename = secure_filename(file.filename)
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(path)
    return {'video_url': url_for('uploaded_file', filename=filename)}

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@socketio.on('join')
def handle_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    emit('chat', {'username': 'System', 'message': f"{username} joined the room."}, to=room)

@socketio.on('chat')
def handle_chat(data):
    emit('chat', data, to=data['room'])

@socketio.on('video-control')
def handle_video_control(data):
    emit('video-control', data, to=data['room'], include_self=False)

@socketio.on('share-video')
def handle_share_video(data):
    emit('share-video', data, to=data['room'], include_self=False)




if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # Use PORT from environment, fallback to 5000
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)


