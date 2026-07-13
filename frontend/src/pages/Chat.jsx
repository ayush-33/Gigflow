import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import axios from "axios";
import toast from "react-hot-toast";
import "../styles/Chat.css";
import SystemMessageCard from "../components/SystemMessageCard";

/* ── helpers ── */
function buildRoomId(gigId, userA, userB) {
  return [userA, userB].sort().join("_") + "_" + gigId;
}

function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const resolveUserId = (userObj) => {
  if (!userObj) return null;
  if (typeof userObj === "string") return userObj;
  return userObj._id?.toString() || userObj.id?.toString() || null;
};

/* ── Offer bubble ── */
function OfferBubble({ msg, isMine }) {
  const isPending = msg.offerStatus === "pending";
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
        <div className="offer-status-redirect">
          👉 Respond to this offer on your Dashboard
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

function MessageStatus({ status }) {
  if (status === "read") {
    return <span style={{ color: "#3b82f6", marginLeft: "5px", fontWeight: "bold" }}>✓✓</span>;
  }
  if (status === "delivered") {
    return <span style={{ color: "#94a3b8", marginLeft: "5px" }}>✓✓</span>;
  }
  return <span style={{ color: "#94a3b8", marginLeft: "5px" }}>✓</span>;
}

/* ── Message bubble ── */
function MessageBubble({ msg, isMine, onAccept, onReject, onCounter }) {
  if (msg.type === "system") {
    return <SystemMessageCard msg={msg} />;
  }

  if (msg.type === "offer") {
    return (
      <div className={`msg-row ${isMine ? "mine" : "theirs"}`}>
        {!isMine && (
          <div className="msg-sender-name">
            {msg.senderId?.name || "User"}
          </div>
        )}
        <OfferBubble
          msg={msg}
          isMine={isMine}
          onAccept={onAccept}
          onReject={onReject}
          onCounter={onCounter}
        />
        <span className="msg-time">
          {formatTime(msg.createdAt)}
          {isMine && <MessageStatus status={msg.status} />}
        </span>
      </div>
    );
  }

  return (
    <div className={`msg-row ${isMine ? "mine" : "theirs"}`}>
      {!isMine && (
        <div className="msg-sender-name">
          {msg.senderId?.name || "User"}
        </div>
      )}
      <div className={`msg-bubble ${isMine ? "mine" : "theirs"}`}>
        {msg.message}
      </div>
      <span className="msg-time">
        {formatTime(msg.createdAt)}
        {isMine && <MessageStatus status={msg.status} />}
      </span>
    </div>
  );
}

/* ── Room list sidebar item ── */
function RoomItem({ room, active, onClick, currentUserId }) {
  const lastMsgTime = room.lastMessage?.createdAt ? relTime(room.lastMessage.createdAt) : "";

  return (
    <div
      className={`room-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="room-avatar">
        {room.otherUser?.name?.charAt(0)?.toUpperCase() || "U"}
      </div>
      <div className="room-info">
        <div className="room-info-main">
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: "4px" }}>
            <span className={`room-participant-name ${room.unreadCount > 0 ? "unread-bold" : ""}`} style={{ marginRight: "4px" }}>
              {room.otherUser?.name || "Participant"}
            </span>
            {room.currentBidId?.status && (
              <span className={`bid-status-chip ${room.currentBidId.status}`}>
                {room.currentBidId.status}
              </span>
            )}
            {room.bidHistory && room.bidHistory.length > 1 && (
              <span className="bid-rebid-badge">
                Rebid ({room.bidHistory.length})
              </span>
            )}
          </div>
          <div className={`room-last-msg ${room.unreadCount > 0 ? "unread-bold" : ""}`}>
            {room.lastMessage?.type === "offer"
              ? `💰 Offer: $${room.lastMessage?.price}`
              : room.lastMessage?.message || "No messages yet"}
          </div>
        </div>
        <div className="room-info-meta">
          <span className="room-time">{lastMsgTime}</span>
          {room.unreadCount > 0 && (
            <span className="room-unread-badge">
              {room.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN CHAT PAGE
════════════════════════════════════════ */
export default function Chat() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // From navigation state (when opening chat from GigDetails)
  const initGigId = location.state?.gigId;
  const initReceiverId = location.state?.receiverId;
  const initGigTitle = location.state?.gigTitle;
  const initGigPrice = location.state?.gigPrice;

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [typing, setTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimer = useRef(null);
  const { socket } = useAuth();

  // Refs for tracking state inside socket event listeners to avoid stale closures
  const activeRoomRef = useRef(activeRoom);
  const userRef = useRef(user);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!activeRoom) return;
    const currentRoom = rooms.find(r => r.roomId === activeRoom.roomId);
    if (currentRoom && JSON.stringify(currentRoom.bidHistory) !== JSON.stringify(activeRoom.bidHistory)) {
      setActiveRoom(prev => ({
        ...prev,
        bidHistory: currentRoom.bidHistory,
        currentBidId: currentRoom.currentBidId
      }));
    }
  }, [rooms, activeRoom?.roomId]);

  const processedInitRef = useRef(false);

  const otherUserName = activeRoom?.otherUser?.name
    || rooms.find(r => r._id === activeRoom?.roomId)?.otherUser?.name
    || location.state?.receiverName
    || "Chat";

  const showToast = (msg, type = "success") => {
    if (type === "success") {
      toast.success(msg);
    } else {
      toast.error(msg);
    }
  };

  /* ── Scroll to bottom ── */
  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollBottom(); }, [messages, scrollBottom]);

  /* ── Load rooms ── */
  useEffect(() => {
    api.get("/conversations")
      .then(r => setRooms(r.data))
      .catch(() => { });
  }, []);

  /* ── Open room from URL (Single Source of Truth) ── */
  useEffect(() => {
    if (!urlRoomId || !user) {
      setActiveRoom(null);
      setMessages([]);
      return;
    }
    if (activeRoom?.roomId === urlRoomId) return;

    const controller = new AbortController();
    api.get(`/conversations/${urlRoomId}`, { signal: controller.signal })
      .then(res => {
        setActiveRoom(res.data);
        setMessages([]);
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.error("Failed to load conversation details:", err.message);
        setActiveRoom(null);
        setMessages([]);
      });

    return () => {
      controller.abort();
    };
  }, [urlRoomId, user]);

  /* ── If opened from GigDetails/Profile state navigation ── */
  useEffect(() => {
    if (processedInitRef.current) return;
    if (!initGigId || !initReceiverId || !user || rooms.length === 0) return;

    processedInitRef.current = true;

    const matchedRoom = rooms.find(r =>
      r.gigId?.toString() === initGigId.toString() &&
      (r.otherUser?._id?.toString() === initReceiverId.toString() || r.otherUser?.id?.toString() === initReceiverId.toString())
    );

    let rId;
    if (matchedRoom) {
      rId = matchedRoom.roomId;
    } else {
      // Fallback constructor for backward compatibility during migration window
      rId = [user._id, initReceiverId].sort().join("_") + "_" + initGigId;
    }

    setMessages([]);
    navigate(`/chat/${rId}`, { replace: true, state: null });
  }, [rooms, initGigId, initReceiverId, user, navigate]);

  /* ── Load messages for active room ── */
  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setLoadingMsgs(true);
    setMessages([]);
    api.get(`/conversations/${activeRoom.roomId}/messages`, { signal: controller.signal })
      .then(r => {
        setMessages(Array.isArray(r.data) ? r.data : []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setMessages([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingMsgs(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activeRoom?.roomId]);

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

    const handleReceiveMessage = (msg) => {
      const active = activeRoomRef.current;
      const currentUser = userRef.current;
      const isFromActiveRoom = msg.roomId === active?.roomId;

      if (isFromActiveRoom) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        const receiverIdStr = resolveUserId(msg.receiverId);
        if (receiverIdStr === resolveUserId(currentUser)) {
          socket.emit("markSeen", { roomId: active.roomId });
        }
      }

      setRooms(prev => {
        const roomExists = prev.some(room => (room.roomId || room._id) === msg.roomId);
        if (!roomExists) {
          api.get("/conversations")
            .then(r => setRooms(r.data))
            .catch(() => { });
          return prev;
        }

        return prev.map(room => {
          const isThisRoom = (room.roomId || room._id) === msg.roomId;
          if (isThisRoom) {
            const isCurrentActive = active?.roomId === msg.roomId;
            return {
              ...room,
              lastMessage: msg,
              unreadCount: isCurrentActive ? 0 : (room.unreadCount || 0) + 1
            };
          }
          return room;
        });
      });
    };

    const handleNewMessage = (msg) => {
      const active = activeRoomRef.current;
      const currentUser = userRef.current;
      const isFromActiveRoom = msg.roomId === active?.roomId;

      if (isFromActiveRoom) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        const receiverIdStr = resolveUserId(msg.receiverId);
        if (receiverIdStr === resolveUserId(currentUser)) {
          socket.emit("markSeen", { roomId: active.roomId });
        }
      }

      setRooms(prev => {
        const roomExists = prev.some(room => (room.roomId || room._id) === msg.roomId);
        if (!roomExists) {
          api.get("/conversations")
            .then(r => setRooms(r.data))
            .catch(() => { });
          return prev;
        }

        return prev.map(room => {
          const isThisRoom = (room.roomId || room._id) === msg.roomId;
          if (isThisRoom) {
            const isCurrentActive = active?.roomId === msg.roomId;
            return {
              ...room,
              lastMessage: msg,
              unreadCount: isCurrentActive ? 0 : (room.unreadCount || 0) + 1
            };
          }
          return room;
        });
      });
    };

    const handleBidPlaced = (data) => {
      api.get("/conversations")
        .then(r => setRooms(r.data))
        .catch(() => { });
    };

    const handleBidResubmitted = (data) => {
      setRooms(prev => {
        const room = prev.find(r => r.conversationId === data.conversationId || r.roomId === data.roomId);
        if (!room) {
          api.get("/conversations")
            .then(r => setRooms(r.data))
            .catch(() => { });
          return prev;
        }
        const updatedRoom = {
          ...room,
          currentBidId: {
            ...room.currentBidId,
            _id: data.newBidId,
            status: "pending"
          }
        };
        return [updatedRoom, ...prev.filter(r => r.roomId !== room.roomId)];
      });
    };

    const handleConversationUpdated = (data) => {
      setRooms(prev => {
        const exists = prev.some(r => r.conversationId === data.conversationId || r.roomId === data.roomId);
        if (!exists) {
          api.get("/conversations")
            .then(r => setRooms(r.data))
            .catch(() => { });
          return prev;
        }
        return prev.map(r => {
          if (r.conversationId === data.conversationId || r.roomId === data.roomId) {
            const isCurrentActive = activeRoomRef.current?.roomId === r.roomId;
            const isClient = data.clientId ? (resolveUserId(userRef.current) === resolveUserId(data.clientId)) : false;
            const unreadCount = isCurrentActive ? 0 : (isClient ? (data.unreadCount?.client || 0) : (data.unreadCount?.freelancer || 0));

            return {
              ...r,
              lastMessage: data.lastMessage,
              lastMessageAt: data.lastMessageAt,
              unreadCount,
              currentBidId: data.currentBidId ? {
                ...r.currentBidId,
                ...data.currentBidId
              } : r.currentBidId
            };
          }
          return r;
        }).sort((a, b) => new Date(b.lastMessageAt || b.updatedAt) - new Date(a.lastMessageAt || a.updatedAt));
      });

      const active = activeRoomRef.current;
      if (active && (active.conversationId === data.conversationId || active.roomId === data.roomId)) {
        setActiveRoom(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentBidId: data.currentBidId ? {
              ...prev.currentBidId,
              ...data.currentBidId
            } : prev.currentBidId,
            bidHistory: data.bidHistory || prev.bidHistory
          };
        });
      }
    };

    const handleOfferUpdated = ({ messageId, status }) => {
      setMessages(prev =>
        prev.map(m => m._id === messageId ? { ...m, offerStatus: status } : m)
      );
    };

    const handleUserTyping = ({ userName }) => {
      setTypingUser(userName || "Someone");
    };

    const handleUserStopTyping = () => {
      setTypingUser("");
    };

    const handleMessagesSeen = ({ roomId, userId }) => {
      const active = activeRoomRef.current;
      const currentUser = userRef.current;
      if (roomId === active?.roomId && userId !== resolveUserId(currentUser)) {
        setMessages(prev => prev.map(m =>
          resolveUserId(m.senderId) === resolveUserId(currentUser)
            ? { ...m, status: "read" }
            : m
        ));
      }

      setRooms(prev => prev.map(r =>
        (r._id || r.roomId) === roomId
          ? { ...r, unreadCount: 0 }
          : r
      ));
    };

    const handleMessagesDelivered = ({ roomId, receiverId }) => {
      const active = activeRoomRef.current;
      const currentUser = userRef.current;
      if (roomId === active?.roomId) {
        setMessages(prev => prev.map(m =>
          resolveUserId(m.senderId) === resolveUserId(currentUser) && m.status === "sent"
            ? { ...m, status: "delivered" }
            : m
        ));
      }
      setRooms(prev => prev.map(r =>
        (r._id || r.roomId) === roomId && r.lastMessage?.status === "sent"
          ? { ...r, lastMessage: { ...r.lastMessage, status: "delivered" } }
          : r
      ));
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("newMessage", handleNewMessage);
    socket.on("bidPlaced", handleBidPlaced);
    socket.on("bidResubmitted", handleBidResubmitted);
    socket.on("conversationUpdated", handleConversationUpdated);
    socket.on("offerUpdated", handleOfferUpdated);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStopTyping", handleUserStopTyping);
    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("messagesDelivered", handleMessagesDelivered);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("newMessage", handleNewMessage);
      socket.off("bidPlaced", handleBidPlaced);
      socket.off("bidResubmitted", handleBidResubmitted);
      socket.off("conversationUpdated", handleConversationUpdated);
      socket.off("offerUpdated", handleOfferUpdated);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStopTyping", handleUserStopTyping);
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("messagesDelivered", handleMessagesDelivered);
    };
  }, [socket]);


  /* ── Send text message ── */
  const sendMessage = () => {
    if (!text.trim() || !activeRoom || !socket) return;

    socket.emit("sendMessage", {
      roomId: activeRoom.roomId,
      gigId: activeRoom.gigId,
      receiverId: activeRoom.receiverId,
      type: "text",
      message: text.trim(),
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
      roomId: activeRoom.roomId,
      gigId: activeRoom.gigId,
      receiverId: activeRoom.receiverId,
      type: "offer",
      message: offerNote.trim() || `I can do this for $${offerPrice}`,
      price: Number(offerPrice),
    });

    setOfferPrice("");
    setOfferNote("");
    setShowOffer(false);
    showToast("Offer sent!");
  };

  /* ── Handle offer response ── */
  const handleAcceptOffer = async (messageId) => {
    if (!socket || !activeRoom) return;
    socket.emit("offerUpdate", {
      messageId,
      status: "accepted",
      roomId: activeRoom.roomId,
    });
    try {
      const { data } = await api.put(`/conversations/messages/${messageId}/offer`, { status: "accepted" });
      showToast("Offer accepted! 🎉");
      if (data.checkoutData) {
        navigate("/checkout", {
          state: {
            gig: data.checkoutData.gig,
            bid: data.checkoutData.bid,
          }
        });
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to accept offer.", "error");
    }
  };

  const handleRejectOffer = (messageId) => {
    if (!socket || !activeRoom) return;
    socket.emit("offerUpdate", {
      messageId,
      status: "rejected",
      roomId: activeRoom.roomId,
    });
    api.put(`/conversations/messages/${messageId}/offer`, { status: "rejected" });
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
        roomId: activeRoom.roomId,
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

  // openRoomFromList was removed - routing is now entirely URL-driven
  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  return (
    <div className="chat-page">

      {/* ── Sidebar ── */}
      <aside className={`chat-sidebar ${!activeRoom ? "show" : ""}`}>
        <div className="chat-sidebar-header">
          <h2>Messages</h2>
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
                onClick={() => navigate(`/chat/${room.roomId || room._id}`)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── Main chat area ── */}
      <main className={`chat-main ${activeRoom ? "show" : ""}`}>
        {!activeRoom ? (
          <div className="chat-placeholder">
            <div className="chat-placeholder-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a chat from the left, or open one from a gig page</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button className="chat-back-btn" onClick={() => setActiveRoom(null)}>←</button>
                <div className="chat-header-info">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <h3 className="chat-header-project-title" style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--chat-text-pri)" }}>
                      {activeRoom.gigTitle || activeRoom.gig?.title || "Gig Chat"}
                    </h3>
                    {activeRoom.currentBidId?.status && (
                      <span className={`bid-status-chip ${activeRoom.currentBidId.status}`}>
                        {activeRoom.currentBidId.status}
                      </span>
                    )}
                  </div>
                  <div className="chat-header-participant" style={{ fontSize: "13px", fontWeight: "500", color: "var(--chat-text-mut)", marginTop: "4px" }}>
                    Participant: {otherUserName}
                  </div>
                </div>
              </div>

              {activeRoom.bidHistory && activeRoom.bidHistory.length > 0 && (
                <button
                  className="toolbar-btn btn-purple"
                  style={{
                    padding: "6px 12px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    background: "rgba(139, 92, 246, 0.15)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#c084fc",
                    cursor: "pointer",
                    zIndex: 10,
                    width: "fit-content"
                  }}
                  onClick={() => setShowHistory(!showHistory)}
                >
                  📜 History ({activeRoom.bidHistory.length})
                </button>
              )}

              {/* Collapsible Floating Bid History Panel */}
              {showHistory && activeRoom.bidHistory && activeRoom.bidHistory.length > 0 && (
                <div className="bid-history-panel" style={{
                  position: "absolute",
                  top: "72px",
                  right: "24px",
                  width: "250px",
                  background: "var(--chat-bg-sidebar)",
                  border: "1px solid var(--chat-border)",
                  borderRadius: "12px",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  maxHeight: "250px",
                  overflowY: "auto",
                  zIndex: 100
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "8px", marginBottom: "4px" }}>
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "var(--chat-text-pri)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Proposal & Bid History</h4>
                  </div>
                  {activeRoom.bidHistory.map((bidItem, idx) => (
                    <div key={idx} className="bid-history-item" style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "12.5px",
                      background: "rgba(255, 255, 255, 0.02)",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.04)"
                    }}>
                      <span style={{ fontWeight: "600", color: "var(--chat-text-pri)" }}>Attempt #{idx + 1}: ${bidItem.price}</span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span className={`bid-status-chip ${bidItem.status}`}>{bidItem.status}</span>
                        <span style={{ fontSize: "11px", color: "var(--chat-text-mut)" }}>
                          {new Date(bidItem.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                        isMine={resolveUserId(msg.senderId) === resolveUserId(user)}
                        onAccept={handleAcceptOffer}
                        onReject={handleRejectOffer}
                        onCounter={handleCounter}
                      />
                    ))}
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {typingUser && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
                  <div className="typing-indicator" style={{ margin: 0 }}>
                    <span /><span /><span />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, #6b7280)", fontStyle: "italic" }}>
                    {typingUser} is typing...
                  </span>
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


    </div>
  );
}