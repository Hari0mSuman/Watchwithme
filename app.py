from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room
import os
import string
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'
socketio = SocketIO(app, cors_allowed_origins='*')

rooms = {}

def generate_room_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        username = request.form['username']
        room = request.form['room'] or generate_room_code()
        password = request.form.get('password', '')

        session['username'] = username
        session['room'] = room

        if room not in rooms:
            rooms[room] = {'password': password, 'users': set()}
        elif rooms[room]['password'] != password:
            return render_template('index.html', error='Incorrect room password.')

        return redirect(url_for('room'))
    return render_template('index.html')

@app.route('/room')
def room():
    username = session.get('username')
    room = session.get('room')
    if not username or not room:
        return redirect(url_for('index'))
    return render_template('room.html', username=username, room=room)

@socketio.on('join')
def handle_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    emit('chat', {'username': 'System', 'message': f'{username} has joined the room.'}, room=room)

@socketio.on('chat')
def handle_chat(data):
    emit('chat', data, room=data['room'])

@socketio.on('share-youtube')
def handle_youtube(data):
    emit('share-youtube', data, room=data['room'])

@socketio.on('video-control')
def handle_video_control(data):
    emit('video-control', data, room=data['room'])

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # Use PORT from environment, fallback to 5000
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
