package socket

import (
	"code2gather.com/room/src/server/util"
	"encoding/base64"
	"log"

	"code2gather.com/room/src/models"
)

// Manager maintains the set of active clients,
// client room id and user id to client socket mapping, and
// broadcast messages to clients in an active room
type Manager struct {
	// Room ID to clients mapping
	rooms map[string]map[*Client]bool

	// Registered active clients
	clients map[*Client]bool

	// Message to broadcast to room
	broadcast chan RoomBroadcastMessage

	// Register/Connection requests from clients
	register     chan *Client
	roomRegister chan ClientRoomRegistration

	// Unregister/Disconnection requests from clients
	unregister     chan *Client
	roomUnregister chan ClientRoomRegistration
}

func NewManager() *Manager {
	return &Manager{
		rooms:          make(map[string]map[*Client]bool),
		clients:        make(map[*Client]bool),
		broadcast:      make(chan RoomBroadcastMessage),
		register:       make(chan *Client),
		unregister:     make(chan *Client),
		roomRegister:   make(chan ClientRoomRegistration),
		roomUnregister: make(chan ClientRoomRegistration),
	}
}

func (m *Manager) Run() {
	for {
		select {
		case client := <-m.register:
			m.clients[client] = true
		case client := <-m.unregister:
			if _, exists := m.clients[client]; exists {
				delete(m.clients, client)
				close(client.send)
			}
		case action := <-m.roomRegister:
			if _, exists := m.rooms[action.roomId]; !exists {
				log.Println("Create new room")
				m.rooms[action.roomId] = make(map[*Client]bool)
			}
			m.rooms[action.roomId][action.client] = true
		case action := <-m.roomUnregister:
			if _, exists := m.rooms[action.roomId]; exists {
				if _, exists = m.rooms[action.roomId][action.client]; exists {
					delete(m.rooms[action.roomId], action.client)
				}
				if len(m.rooms[action.roomId]) == 0 {
					delete(m.rooms, action.roomId)
				}
			}
		case message := <-m.broadcast:
			b64Bytes := make([]byte, base64.StdEncoding.EncodedLen(len(message.message)))
			base64.StdEncoding.Encode(b64Bytes, message.message)
			log.Println(string(b64Bytes))
			if _, exists := m.rooms[message.roomId]; !exists {
				continue
			}
			for client := range m.rooms[message.roomId] {
				if client.uid == message.exceptId {
					continue
				}
				log.Printf("Broadcast to %s", client.uid)
				select {
				case client.send <- b64Bytes:
				default:
					close(client.send)
					delete(m.clients, client)
				}
			}
		}
	}
}

type RoomBroadcastMessage struct {
	roomId   string
	message  []byte
	exceptId string
}

func NewDisconnectRoomBroadcastMessage(roomId string, disconnectedId string) *RoomBroadcastMessage {
	message := &models.DisconnectBroadcast{DisconnectedUid: disconnectedId}
	messageWrapper := &models.RoomServiceToClientMessage_DisconnectBroadcast{DisconnectBroadcast: message}
	messageBytes, _ := util.MarshalToBytes(&models.RoomServiceToClientMessage{Response: messageWrapper})
	return &RoomBroadcastMessage{roomId: roomId, message: messageBytes, exceptId: disconnectedId}
}

func NewLeftRoomBroadcastMessage(roomId string, leftId string) *RoomBroadcastMessage {
	message := &models.LeaveRoomBroadcast{LeftUid: leftId}
	messageWrapper := &models.RoomServiceToClientMessage_LeaveRoomBroadcast{LeaveRoomBroadcast: message}
	messageBytes, _ := util.MarshalToBytes(&models.RoomServiceToClientMessage{Response: messageWrapper})
	return &RoomBroadcastMessage{roomId: roomId, message: messageBytes, exceptId: leftId}
}

func NewJoinedRoomBroadcastMessage(roomId string, joinedUid string) *RoomBroadcastMessage {
	message := &models.JoinRoomBroadcast{JoinedUid: joinedUid}
	messageWrapper := &models.RoomServiceToClientMessage_JoinRoomBroadcast{JoinRoomBroadcast: message}
	messageBytes, _ := util.MarshalToBytes(&models.RoomServiceToClientMessage{Response: messageWrapper})
	return &RoomBroadcastMessage{roomId: roomId, message: messageBytes, exceptId: joinedUid}
}

type ClientRoomRegistration struct {
	roomId string
	client *Client
}
