import React, { useState, useEffect, useRef, useCallback } from 'react';
import { axiosInstance, API } from '../App';
import { Bell, X, AlertTriangle, Clock, Wallet, CheckCircle } from 'lucide-react';

const NotificationBell = () => {
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`${API}/notifications`);
      setNotifs(res.data.notifications || []);
      setUnread(res.data.unread_count || 0);
    } catch(err) { console.error(err.message); }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    await axiosInstance.put(`${API}/notifications/${id}/read`);
    fetchNotifs();
  };

  const markAllRead = async () => {
    await axiosInstance.put(`${API}/notifications/read-all`);
    fetchNotifs();
  };

  const deleteNotif = async (id) => {
    await axiosInstance.delete(`${API}/notifications/${id}`);
    fetchNotifs();
  };

  const iconMap = {
    overdue: <AlertTriangle size={14} className="text-red-500" />,
    upcoming: <Clock size={14} className="text-amber-500" />,
    low_balance: <Wallet size={14} className="text-blue-500" />,
    auto_payment: <CheckCircle size={14} className="text-green-500" />,
  };

  return (
    <div ref={ref} className="relative" data-testid="notification-bell">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        data-testid="notification-bell-btn">
        <Bell size={20} className="text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            data-testid="notification-count">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 max-h-[70vh] flex flex-col"
          data-testid="notification-panel">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-teal hover:underline" data-testid="mark-all-read-btn">
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No notifications
              </div>
            ) : (
              notifs.slice(0, 20).map(n => (
                <div key={n.id}
                  className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 ${!n.read ? 'bg-teal-50/50' : ''}`}
                  data-testid={`notification-item-${n.id}`}>
                  <div className="mt-0.5 flex-shrink-0">{iconMap[n.type] || <Bell size={14} className="text-slate-400" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{n.created_at?.slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="text-[10px] text-teal hover:underline">Read</button>
                    )}
                    <button onClick={() => deleteNotif(n.id)} className="text-[10px] text-slate-400 hover:text-red-500">Dismiss</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Email status footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <p className="text-[10px] text-slate-400">
              Email reminders: {notifs.some(n => n.email_sent) ? 'Sent' : 'Simulated'} (configure email service for real delivery)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
