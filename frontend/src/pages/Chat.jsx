import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../utils/socket";
import api from "../api/api";
import "../styles/Chat.css";

/* ── helpers ── */
function buildRoomId(gigId, userA, userB) {
  return `${gigId}_${[userA, userB].sort().join("_")}`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(dateStr) {
  const d   = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Offer bubble ── */
function OfferBubble({ msg, isMine, onAccept, onReject, onCounter }) {
  const isPending  = msg.offerStatus === "pending";
  const isAccepted = msg.offerStatus === "accepted";
  const isRejected = msg.offerStatus === "rejected";

  return (
    <div className={`offer-bubble ${isMine ? "mine" : "theirs"}`}>
      <div className="offer-icon">💰</div>
      <div className="offer-content">
        <div className="offer-label">Price Offer</div>
        <div className="offer-price">${msg.price}</div>
        {msg.message && <div className="offer-note">{msg.message}</div>}
      </div>

      {isPending && !isMine && (
        <div className="offer-actions">
          <button className="offer-btn accept" onClick={() => onAccept(msg._id)}>
            ✓ Accept
          </button>
          <button className="offer-btn counter" onClick={() => onCounter(msg.price)}>
            ↩ Counter
          </button>
          <button className="offer-btn reject" onClick={() => onReject(msg._id)}>
            ✕ Decline
          </button>
        </div>
      )}

      {isPending && isMine && (
        <div className="offer-status pending">⏳ Awaiting response</div>
      )}
      {isAccepted && (
        <div className="offer-status accepted">✅ Offer accepted</div>
      )}
      {isRejected && (
        <div className="offer-status rejected">❌ Offer declined</div>
      )}
    </div>
  );
}

/* ── Message bubble ── */
function MessageBubble({ msg, isMine, onAccept, onReject, onCounter }) {
  if (msg.type === "system") {
    return (
      <div className="system-msg">
        <span>{msg.message}</span>
      </div>
    );
  }

  if (msg.type === "offer") {
    return (
      <div className={`msg-row ${isMine ? "mine" : "theirs"}`}>
        <OfferBubble
          msg={msg}
          isMine={isMine}
          onAccept={onAccept}
          onReject={onReject}
          onCounter={onCounter}
        />
        <span className="msg-time">{formatTime(msg.createdAt)}</span>
      </div>
    );
  }

  return (
    <div className={`msg-row ${isMine ? "mine" : "theirs"}`}>
      <div className={`msg-bubble ${isMine ? "mine" : "theirs"}`}>
        {msg.message}
      </div>
      <span className="msg-time">{formatTime(msg.createdAt)}</span>
    </div>
  );
}

/* ── Room list sidebar item ── */
function RoomItem({ room, active, onClick, currentUserId }) {

  return (
    <div
      className={`room-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="room-avatar">
        {room.gig?.title?.charAt(0)?.toUpperCase() || "G"}
      </div>
      <div className="room-info">
        <div className="room-gig-title">{room.gig?.title || "Gig Chat"}</div>
        <div className="room-last-msg">
{room.lastMessage?.type === "offer"
  ? `💰 Offer: $${room.lastMessage?.price}`
  : (room.lastMessage?.message || "").slice(0, 40) + (room.lastMessage?.message?.length > 40 ? "…" : "")}
        </div>
      </div>
      <div className="room-meta">
  <span className="room-time">
    {room.lastMessage?.createdAt && formatTime(room.lastMessage.createdAt)}
  </span>

  {room.unreadCount > 0 && (
    <span className="room-badge">{room.unreadCount}</span>
  )}
</div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN CHAT PAGE
════════════════════════════════════════ */
export default function Chat() {
  const { roomId: urlRoomId } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  // From navigation state (when opening chat from GigDetails)
  const initGigId      = location.state?.gigId;
  const initReceiverId = location.state?.receiverId;
  const initGigTitle   = location.state?.gigTitle;
  const initGigPrice   = location.state?.gigPrice;

  const [rooms,        setRooms]        = useState([]);
  const [activeRoom,   setActiveRoom]   = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [text,         setText]         = useState("");
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [showOffer,    setShowOffer]    = useState(false);
  const [offerPrice,   setOfferPrice]   = useState("");
  const [offerNote,    setOfferNote]    = useState("");
  const [typing,       setTyping]       = useState(false);
  const [otherTyping,  setOtherTyping]  = useState(false);
  const [toast,        setToast]        = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimer    = useRef(null);
  const socket         = getSocket();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  /* ── Scroll to bottom ── */
  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  /* ── Load rooms ── */
  useEffect(() => {
    api.get("/chat/rooms")
    
      .then(r => setRooms(r.data))
      .catch(() => {});
  }, []);

  // ── Open room from URL ──
useEffect(() => {
  if (!urlRoomId || rooms.length === 0) return;

  const room = rooms.find(r => (r._id || r.roomId) === urlRoomId);
  if (room) openRoomFromList(room);

}, [urlRoomId, rooms]);

  /* ── If opened from GigDetails, auto-set active room ── */
  useEffect(() => {
    if (!initGigId || !initReceiverId || !user) return;
    const rId = buildRoomId(initGigId, user._id, initReceiverId);
    setActiveRoom({
      roomId:      rId,
      gigId:       initGigId,
      receiverId:  initReceiverId,
      gigTitle:    initGigTitle,
      gigPrice:    initGigPrice,
    });
  }, [initGigId, initReceiverId, user, initGigTitle, initGigPrice]);

  /* ── Load messages for active room ── */
  useEffect(() => {
    if (!activeRoom) return;
    setLoadingMsgs(true);
    api.get(`/chat/rooms/${activeRoom.roomId}/messages`)
      .then(r => {
        setMessages(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeRoom]);

useEffect(() => {
  if (!socket || !activeRoom) return;

  // join room
  socket.emit("joinRoom", activeRoom.roomId);

  // mark messages as seen
  socket.emit("markSeen", {
    roomId: activeRoom.roomId,
  });

  return () => {
    socket.emit("leaveRoom", activeRoom.roomId);
  };

}, [socket, activeRoom?.roomId]);

  /* ── Socket: listen for messages ── */
  useEffect(() => {
    if (!socket) return;

socket.on("receiveMessage", (msg) => {
  setMessages(prev => {
    if (prev.some(m => m._id === msg._id)) return prev;
    return [...prev, msg];
  });

  setRooms(prev =>
  prev.map(room =>
    (room._id || room.roomId) === activeRoom?.roomId
      ? { ...room, lastMessage: msg, unreadCount: 0 }
      : {
          ...room,
          lastMessage: msg,
          unreadCount: (room.unreadCount || 0) + 1
        }
  )
);
});

    socket.on("offerUpdated", ({ messageId, status }) => {
      setMessages(prev =>
        prev.map(m => m._id === messageId ? { ...m, offerStatus: status } : m)
      );
    });

    socket.on("userTyping", ({ userName }) => {
      setOtherTyping(true);
    });

    socket.on("userStopTyping", () => {
      setOtherTyping(false);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("offerUpdated");
      socket.off("userTyping");
      socket.off("userStopTyping");
    };
}, [socket, activeRoom?.roomId]);


  /* ── Send text message ── */
  const sendMessage = () => {
    if (!text.trim() || !activeRoom || !socket) return;

    socket.emit("sendMessage", {
      roomId:     activeRoom.roomId,
      gigId:      activeRoom.gigId,
      receiverId: activeRoom.receiverId,
      type:       "text",
      message:    text.trim(),
    });

    setText("");
    // Stop typing
    socket.emit("stopTyping", { roomId: activeRoom.roomId });
  };

  /* ── Send offer ── */
  const sendOffer = () => {
    if (!offerPrice || isNaN(offerPrice) || Number(offerPrice) < 1) {
      showToast("Enter a valid price", "error");
      return;
    }
    if (!activeRoom || !socket) return;

    socket.emit("sendMessage", {
      roomId:     activeRoom.roomId,
      gigId:      activeRoom.gigId,
      receiverId: activeRoom.receiverId,
      type:       "offer",
      message:    offerNote.trim() || `I can do this for $${offerPrice}`,
      price:      Number(offerPrice),
    });

    setOfferPrice("");
    setOfferNote("");
    setShowOffer(false);
    showToast("Offer sent!");
  };

  /* ── Handle offer response ── */
  const handleAcceptOffer = (messageId) => {
    if (!socket || !activeRoom) return;
    socket.emit("offerUpdate", {
      messageId,
      status: "accepted",
      roomId: activeRoom.roomId,
    });
    // Also update via REST for persistence
    api.put(`/chat/messages/${messageId}/offer`, { status: "accepted" });
    showToast("Offer accepted! 🎉");
  };

  const handleRejectOffer = (messageId) => {
    if (!socket || !activeRoom) return;
    socket.emit("offerUpdate", {
      messageId,
      status: "rejected",
      roomId: activeRoom.roomId,
    });
    api.put(`/chat/messages/${messageId}/offer`, { status: "rejected" });
    showToast("Offer declined.");
  };

  const handleCounter = (originalPrice) => {
    setOfferPrice(String(originalPrice));
    setShowOffer(true);
  };

  /* ── Typing indicator ── */
  const handleTyping = (e) => {
    setText(e.target.value);
    if (!socket || !activeRoom) return;

    if (!typing) {
      setTyping(true);
      socket.emit("typing", {
        roomId:   activeRoom.roomId,
        userName: user?.name,
      });
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTyping(false);
      socket.emit("stopTyping", { roomId: activeRoom.roomId });
    }, 1500);
  };

  /* ── Key handler ── */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Group messages by day ── */
  const groupedMessages = messages.reduce((acc, msg) => {
    const day = formatDay(msg.createdAt);
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  /* ── Open chat from gig page ── */
  const openRoomFromList = (room) => {
const senderId =
  room.lastMessage?.senderId?._id ||
  room.lastMessage?.senderId ||
  null;
const receiverId =
  senderId === user?._id
    ? room.lastMessage?.receiverId
    : senderId || room.participants?.find(id => id !== user?._id);

    setActiveRoom({
      roomId:    room._id,
      gigId:     room.gigId,
      receiverId,
      gigTitle:  room.gig?.title,
      gigPrice:  room.gig?.price,
    });
  };
useEffect(() => {
  if (!user) navigate("/login");
}, [user, navigate]);

  return (
    <div className="chat-page">

      {/* ── Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2>Messages</h2>
          <span className="chat-count">{rooms.length}</span>
        </div>

        {rooms.length === 0 ? (
          <div className="chat-empty-rooms">
            <div className="chat-empty-icon">💬</div>
            <p>No conversations yet</p>
            <span>Start a chat from any gig page</span>
          </div>
        ) : (
          <div className="room-list">
            {rooms.map(room => (
              <RoomItem
                key={room._id}
                room={room}
                active={activeRoom?.roomId === room._id}
                currentUserId={user?._id}
                onClick={() => openRoomFromList(room)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── Main chat area ── */}
      <main className="chat-main">
        {!activeRoom ? (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a chat from the left, or open one from a gig page</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header">
              <button className="chat-back-btn" onClick={() => setActiveRoom(null)}>←</button>
              <div className="chat-header-info">
                <div className="chat-header-title">{activeRoom.gigTitle || "Chat"}</div>
                <div className="chat-header-sub">
                  {activeRoom.gigPrice ? `Budget: $${activeRoom.gigPrice}` : "Gig Chat"}
                </div>
              </div>
              <button
                className="chat-offer-trigger"
                onClick={() => setShowOffer(p => !p)}
                title="Make an offer"
              >
                💰 Make Offer
              </button>
            </div>

            {/* Offer panel */}
            {showOffer && (
              <div className="offer-panel">
                <div className="offer-panel-title">Send a Price Offer</div>
                <div className="offer-panel-row">
                  <div className="offer-input-wrap">
                    <span className="offer-symbol">$</span>
                    <input
                      className="offer-price-input"
                      type="number"
                      placeholder="Your price"
                      value={offerPrice}
                      min="1"
                      onChange={e => setOfferPrice(e.target.value)}
                    />
                  </div>
                  <input
                    className="offer-note-input"
                    placeholder="Add a note (optional)"
                    value={offerNote}
                    onChange={e => setOfferNote(e.target.value)}
                  />
                  <button className="offer-send-btn" onClick={sendOffer}>
                    Send Offer →
                  </button>
                  <button className="offer-cancel-btn" onClick={() => setShowOffer(false)}>
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
              {loadingMsgs ? (
                <div className="chat-loading">
                  <div className="chat-spinner" />
                  <span>Loading messages…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="chat-no-msgs">
                  <div className="chat-no-msgs-icon">👋</div>
                  <p>No messages yet — say hello!</p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([day, msgs]) => (
                  <div key={day}>
                    <div className="day-divider"><span>{day}</span></div>
                    {msgs.map(msg => (
                      <MessageBubble
                        key={msg._id}
                        msg={msg}
isMine={(msg.senderId?._id || msg.senderId) === user?._id}
                        onAccept={handleAcceptOffer}
                        onReject={handleRejectOffer}
                        onCounter={handleCounter}
                      />
                    ))}
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {otherTyping && (
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
              <textarea
                className="chat-input"
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                value={text}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="chat-send-btn"
                onClick={sendMessage}
                disabled={!text.trim()}
              >
                ➤
              </button>
            </div>
          </>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`chat-toast ${toast.type}`}>
          {toast.type === "success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  );
}