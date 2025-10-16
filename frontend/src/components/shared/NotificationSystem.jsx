import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info, Navigation } from 'lucide-react';

// Hook personalizado para notificaciones
export const useNotifications = (supabase, user) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Cargar notificaciones existentes
    loadNotifications();

    // Suscribirse a cambios en tiempo real
    const subscription = supabase
      .channel('notifications_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'searching_pool',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { new: newData, old: oldData, eventType } = payload;

    if (eventType === 'UPDATE') {
      // Detectar cambios importantes y crear notificación
      if (oldData.status !== newData.status) {
        const notification = createNotificationFromStatusChange(newData);
        if (notification) {
          addNotification(notification);
        }
      }
    }
  };

  const createNotificationFromStatusChange = (data) => {
    const notifications = {
      'matched': {
        title: '¡Encontramos un match!',
        message: data.tipo_de_usuario === 'passenger' 
          ? 'Un conductor ha aceptado tu solicitud'
          : 'Has aceptado pasajeros para tu viaje',
        type: 'success',
        icon: 'checkCircle'
      },
      'in_progress': {
        title: '🚗 Viaje Iniciado',
        message: data.tipo_de_usuario === 'passenger'
          ? 'El conductor va en camino hacia ti'
          : 'Has iniciado el viaje',
        type: 'info',
        icon: 'navigation'
      },
      'completed': {
        title: '✅ Viaje Completado',
        message: '¡Esperamos que hayas disfrutado el viaje!',
        type: 'success',
        icon: 'checkCircle'
      },
      'cancelled': {
        title: '❌ Viaje Cancelado',
        message: 'El viaje ha sido cancelado',
        type: 'warning',
        icon: 'alertCircle'
      }
    };

    return notifications[data.status] || null;
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      ...notification,
      read: false,
      created_at: new Date().toISOString()
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 10));
    setUnreadCount(prev => prev + 1);

    // Mostrar notificación del navegador si está permitido
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png'
      });
    }
  };

  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    addNotification
  };
};

// Componente de Notificación Individual
const NotificationItem = ({ notification, onMarkAsRead, onClose }) => {
  const getIcon = () => {
    const iconMap = {
      checkCircle: CheckCircle,
      alertCircle: AlertCircle,
      info: Info,
      navigation: Navigation
    };
    const IconComponent = iconMap[notification.icon] || Info;
    return <IconComponent className="w-5 h-5" />;
  };

  const getColorClasses = () => {
    const colorMap = {
      success: 'bg-green-50 border-green-200 text-green-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      info: 'bg-blue-50 border-blue-200 text-blue-800'
    };
    return colorMap[notification.type] || colorMap.info;
  };

  return (
    <div 
      className={`border rounded-lg p-4 mb-2 transition-all ${getColorClasses()} ${
        !notification.read ? 'shadow-md' : 'opacity-75'
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-1">{notification.title}</p>
          <p className="text-sm">{notification.message}</p>
          <p className="text-xs opacity-75 mt-2">
            {new Date(notification.created_at).toLocaleString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: 'short'
            })}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {!notification.read && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-xs px-2 py-1 rounded hover:bg-white/50 transition"
            >
              Marcar leída
            </button>
          )}
          <button
            onClick={() => onClose(notification.id)}
            className="hover:bg-white/50 rounded p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Panel de Notificaciones
const NotificationPanel = ({ notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Botón de notificaciones */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel de notificaciones */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">Notificaciones</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-200 rounded transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {notifications.length > 0 && (
                <div className="flex space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                  <button
                    onClick={onClear}
                    className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>

            {/* Lista de notificaciones */}
            <div className="overflow-y-auto max-h-[calc(80vh-100px)] p-4">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={onMarkAsRead}
                    onClose={(id) => {
                      // Implementar lógica de eliminar notificación individual
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Toast de Notificación (aparece en esquina)
export const NotificationToast = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const getColorClasses = () => {
    const colorMap = {
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-blue-500'
    };
    return colorMap[notification.type] || colorMap.info;
  };

  return (
    <div 
      className={`fixed top-20 right-6 z-50 transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${getColorClasses()} text-white rounded-lg shadow-2xl p-4 max-w-sm`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold mb-1">{notification.title}</p>
            <p className="text-sm opacity-90">{notification.message}</p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;