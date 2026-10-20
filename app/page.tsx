'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type Book = {
  id?: number;
  title: string;
  price: number;
  status: string;
  image_url?: string;
  status_type?: 'active' | 'negotiating' | 'sold';
  negotiated_at?: string;
  completed_at?: string;
  report_count?: number;
  like_count?: number;
  is_hidden?: boolean;
  seller_token?: string;
  seller_name?: string;
  negotiator_token?: string;
  negotiator_name?: string;
  seller_email?: string;
};

type Chat = {
  id: string;
  buyer_token: string;
  buyer_name?: string;
  seller_token: string;
  seller_name?: string;
  buyer_email?: string;
  seller_email?: string;
  created_at: string;
};

type Message = {
  id: string;
  chat_id: string;
  sender_token: string;
  sender_name?: string;
  content: string;
  created_at: string;
};

type AppNotification = {
  id: string;
  user_token: string;
  title: string;
  body: string;
  is_read: boolean;
  chat_id?: string;
  created_at: string;
};

type AnalyticsData = {
  today: number;
  thisMonth: number;
  total: number;
};

type ChartData = {
  label: string;
  pv: number;
};

const PREMIUM_POPUP_ADS = [
  {
    id: 1,
    company: '学内教科書フリマ運営',
    catchcopy: '【完全無料】使わなくなった教科書を後輩にバトンタッチしよう📚',
    description: '登録・手数料すべて無料！スマホから30秒で簡単に出品できます。安全な学内手渡しで安心取引！',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80',
    tag: '公式お知らせ',
  },
  {
    id: 2,
    company: '学内教科書フリマ運営',
    catchcopy: '欲しかったあの教科書、安く手に入るかも✨',
    description: '同じキャンパスの学生同士だから送料もかからない！お気に入りの登録やまとめ買い機能も活用してね。',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    tag: '使い方ガイド',
  },
];

const ADMIN_PASSCODE = 'admin9999';
const NG_WORDS = ['死ね', '殺す', 'バカ', 'アホ', '売春', '薬物', '違法', 'hack', 'scam'];

export default function Home() {
  const [books, setBooks] = useState<Book[]>([]);
  const [searchWord, setSearchWord] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'negotiating' | 'sold' | 'liked' | 'mine'>('all');
  
  // ユーザー・ニックネーム設定
  const [myNickname, setMyNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [tempNicknameInput, setTempNicknameInput] = useState('');

  // フォーム用ステータス
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStatus, setNewStatus] = useState('目立った傷なし');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  
  // モーダル表示の切り替え
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMyPageModal, setShowMyPageModal] = useState(false);
  
  // ユーザー設定
  const [myBookIds, setMyBookIds] = useState<number[]>([]);
  const [reportedBookIds, setReportedBookIds] = useState<(number | string)[]>([]);
  const [likedBookIds, setLikedBookIds] = useState<number[]>([]);
  const [mySellerToken, setMySellerToken] = useState<string>('');
  
  // モーダル・選択
  const [selectedBundleBookIds, setSelectedBundleBookIds] = useState<number[]>([]);
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [bulkDeleteBookIds, setBulkDeleteBookIds] = useState<number[]>([]);
  const [showTerms, setShowTerms] = useState(false);
  const [showQA, setShowQA] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activePopupAd, setActivePopupAd] = useState<typeof PREMIUM_POPUP_ADS[0] | null>(null);
  const [showPopupAd, setShowPopupAd] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // 📊 アナリティクスデータ ＆ グラフ用ステータス
  const [analytics, setAnalytics] = useState<AnalyticsData>({ today: 0, thisMonth: 0, total: 0 });
  const [dailyChartData, setDailyChartData] = useState<ChartData[]>([]);
  const [monthlyChartData, setMonthlyChartData] = useState<ChartData[]>([]);
  const [chartViewMode, setChartViewMode] = useState<'daily' | 'monthly'>('daily');
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);

  // 拡大表示（ライトボックス）用
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // 💬 アプリ内チャット & 通知システム用ステータス
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [myChats, setMyChats] = useState<Chat[]>([]);
  const [showChatList, setShowChatList] = useState(false);

  // チャットごとの既読管理
  const [readTimestamps, setReadTimestamps] = useState<Record<string, number>>({});
  const [unreadChatMap, setUnreadChatMap] = useState<Record<string, boolean>>({});

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const savedIds = localStorage.getItem('my_book_ids');
      if (savedIds) setMyBookIds(JSON.parse(savedIds));

      const savedReports = localStorage.getItem('reported_book_ids');
      if (savedReports) setReportedBookIds(JSON.parse(savedReports));

      const savedLikes = localStorage.getItem('liked_book_ids');
      if (savedLikes) setLikedBookIds(JSON.parse(savedLikes));

      const savedReadMap = localStorage.getItem('chat_read_timestamps');
      if (savedReadMap) setReadTimestamps(JSON.parse(savedReadMap));

      let token = localStorage.getItem('my_seller_token');
      if (!token) {
        token = 'seller_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('my_seller_token', token);
      }
      setMySellerToken(token);

      const savedNick = localStorage.getItem('my_nickname');
      if (savedNick) {
        setMyNickname(savedNick);
      } else {
        setShowNicknameModal(true);
      }

      const randomIndex = Math.floor(Math.random() * PREMIUM_POPUP_ADS.length);
      setActivePopupAd(PREMIUM_POPUP_ADS[randomIndex]);
      setShowPopupAd(true);
    } catch (e) {
      console.error('localStorage error:', e);
    }
    
    trackPageViewOncePerDay();
    fetchBooks();

    const handleFocus = () => fetchBooks();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (isAdminMode) {
      fetchAnalytics();
    }
  }, [isAdminMode]);

  const trackPageViewOncePerDay = async () => {
    try {
      const todayStr = new Date().toDateString();
      const lastTrackedDate = localStorage.getItem('last_tracked_date');

      if (lastTrackedDate !== todayStr) {
        await supabase.from('page_views').insert([{}]);
        localStorage.setItem('last_tracked_date', todayStr);
      }
    } catch (err) {
      console.error('Analytics tracking error:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase.from('page_views').select('created_at');
      if (error || !data) return;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      let todayCount = 0;
      let monthCount = 0;
      const totalCount = data.length;

      const dailyMap: Record<string, number> = {};
      const dailyList: { label: string; dateStr: string; pv: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const dateStr = `${d.getFullYear()}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
        const label = `${month}/${date}`;
        dailyMap[dateStr] = 0;
        dailyList.push({ label, dateStr, pv: 0 });
      }

      const monthlyMap: Record<string, number> = {};
      const monthlyList: { label: string; monthKey: string; pv: number }[] = [];
      for (let i = 23; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = m.getFullYear();
        const month = m.getMonth() + 1;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const label = i % 3 === 0 ? `${year.toString().slice(2)}/${month}` : `${month}月`;
        monthlyMap[monthKey] = 0;
        monthlyList.push({ label, monthKey, pv: 0 });
      }

      data.forEach((row) => {
        const t = new Date(row.created_at);
        const time = t.getTime();

        if (time >= startOfToday) todayCount++;
        if (time >= startOfMonth) monthCount++;

        const dateStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        if (dailyMap[dateStr] !== undefined) {
          dailyMap[dateStr]++;
        }

        const monthKey = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap[monthKey] !== undefined) {
          monthlyMap[monthKey]++;
        }
      });

      setAnalytics({
        today: todayCount,
        thisMonth: monthCount,
        total: totalCount,
      });

      setDailyChartData(
        dailyList.map((item) => ({
          label: item.label,
          pv: dailyMap[item.dateStr] || 0,
        }))
      );

      setMonthlyChartData(
        monthlyList.map((item) => ({
          label: item.label,
          pv: monthlyMap[item.monthKey] || 0,
        }))
      );
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  };

  const handleRefreshAnalytics = async () => {
    setIsRefreshingAnalytics(true);
    try {
      await fetchAnalytics();
      alert('📊 アクセス実績・グラフデータを更新しました！');
    } catch (e) {
      alert('更新に失敗しました');
    } finally {
      setIsRefreshingAnalytics(false);
    }
  };

  useEffect(() => {
    if (!mySellerToken) return;

    fetchMyChats();
    fetchNotifications();

    const notificationChannel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_token=eq.${mySellerToken}` },
        (payload) => {
          setNotifications((prev) => [payload.new as AppNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [mySellerToken]);

  useEffect(() => {
    if (!activeChat) return;

    fetchMessages(activeChat.id);

    const now = Date.now();
    const updatedReadMap = { ...readTimestamps, [activeChat.id]: now };
    setReadTimestamps(updatedReadMap);
    localStorage.setItem('chat_read_timestamps', JSON.stringify(updatedReadMap));

    setUnreadChatMap(prev => ({ ...prev, [activeChat.id]: false }));

    const messageChannel = supabase
      .channel(`chat:${activeChat.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeChat.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          const updatedNow = Date.now();
          const nextReadMap = { ...readTimestamps, [activeChat.id]: updatedNow };
          setReadTimestamps(nextReadMap);
          localStorage.setItem('chat_read_timestamps', JSON.stringify(nextReadMap));

          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [activeChat]);

  const checkUnreadMessages = async (chats: Chat[]) => {
    if (!chats || chats.length === 0 || !mySellerToken) return;

    const newUnreadMap: Record<string, boolean> = {};

    for (const chat of chats) {
      const lastReadTime = readTimestamps[chat.id] || 0;

      const { data: latestMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .neq('sender_token', mySellerToken)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestMsg && latestMsg.length > 0) {
        const msgTime = new Date(latestMsg[0].created_at).getTime();
        if (msgTime > lastReadTime) {
          newUnreadMap[chat.id] = true;
        } else {
          newUnreadMap[chat.id] = false;
        }
      } else {
        newUnreadMap[chat.id] = false;
      }
    }

    setUnreadChatMap(newUnreadMap);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tempNicknameInput.trim();
    if (!trimmed) {
      alert('ニックネームを入力してください');
      return;
    }

    try {
      const { data: chatBuyers } = await supabase.from('chats').select('buyer_name').eq('buyer_name', trimmed);
      const { data: chatSellers } = await supabase.from('chats').select('seller_name').eq('seller_name', trimmed);
      const { data: bookSellers } = await supabase.from('books').select('seller_name').eq('seller_name', trimmed);

      const isTaken = (chatBuyers && chatBuyers.length > 0) || 
                     (chatSellers && chatSellers.length > 0) || 
                     (bookSellers && bookSellers.length > 0);

      if (isTaken) {
        alert('⚠️ このアカウント名はすでに使用されています。別の名前を入力してください。');
        return;
      }
    } catch (err) {
      console.log('重複チェックエラー', err);
    }

    setMyNickname(trimmed);
    localStorage.setItem('my_nickname', trimmed);
    setShowNicknameModal(false);
  };

  const handleNameChangeInMyPage = async () => {
    const newNick = prompt('新しいアカウント名（ニックネーム）を入力してください:', myNickname);
    if (newNick && newNick.trim()) {
      const trimmed = newNick.trim();
      if (trimmed === myNickname) return;

      try {
        const { data: chatBuyers } = await supabase.from('chats').select('buyer_name').eq('buyer_name', trimmed);
        const { data: chatSellers } = await supabase.from('chats').select('seller_name').eq('seller_name', trimmed);
        const { data: bookSellers } = await supabase.from('books').select('seller_name').eq('seller_name', trimmed);

        const isTaken = (chatBuyers && chatBuyers.length > 0) || 
                        (chatSellers && chatSellers.length > 0) || 
                        (bookSellers && bookSellers.length > 0);

        if (isTaken) {
          alert('⚠️ この名前はすでに他のユーザーに使用されています。別の名前を入力してください。');
          return;
        }
      } catch (e) {}

      setMyNickname(trimmed);
      localStorage.setItem('my_nickname', trimmed);

      try {
        await supabase.from('chats').update({ buyer_name: trimmed }).eq('buyer_token', mySellerToken);
        await supabase.from('chats').update({ seller_name: trimmed }).eq('seller_token', mySellerToken);
        await supabase.from('books').update({ seller_name: trimmed }).eq('seller_token', mySellerToken);
      } catch (e) {}

      alert('アカウント名を変更しました！');
      fetchMyChats();
      fetchBooks();
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('books').select('*');
      if (error) {
        console.error('取得エラー:', error);
      } else {
        const now = new Date().getTime();
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const rawBooks = data || [];
        const existingIds = rawBooks.map((item: any) => item.id).filter(Boolean);

        const cleanedMyBookIds = myBookIds.filter(id => existingIds.includes(id));
        if (cleanedMyBookIds.length !== myBookIds.length) {
          setMyBookIds(cleanedMyBookIds);
          localStorage.setItem('my_book_ids', JSON.stringify(cleanedMyBookIds));
        }

        const cleanedLikedIds = likedBookIds.filter(id => existingIds.includes(id));
        if (cleanedLikedIds.length !== likedBookIds.length) {
          setLikedBookIds(cleanedLikedIds);
          localStorage.setItem('liked_book_ids', JSON.stringify(cleanedLikedIds));
        }

        const formattedData = rawBooks.map((item: any) => ({
          ...item,
          status_type: item.status_type || (item.is_sold ? 'sold' : 'active'),
          report_count: item.report_count || 0,
          like_count: item.like_count || 0,
          is_hidden: item.is_hidden || (item.report_count >= 3),
        })).filter((item: Book) => {
          if (item.is_hidden || (item.report_count || 0) >= 3) return false;
          if (item.status_type === 'sold' && item.completed_at) {
            const completedTime = new Date(item.completed_at).getTime();
            if (!isNaN(completedTime) && now - completedTime > ONE_WEEK_MS) return false;
          }
          return true;
        });

        setBooks(formattedData);
      }
    } catch (err: any) {
      console.error('通信エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!mySellerToken) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_token', mySellerToken)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const markNotificationsAsRead = async () => {
    if (!mySellerToken) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_token', mySellerToken);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const fetchMyChats = async () => {
    if (!mySellerToken) return;
    const { data } = await supabase
      .from('chats')
      .select('*')
      .or(`buyer_token.eq.${mySellerToken},seller_token.eq.${mySellerToken}`)
      .order('created_at', { ascending: false });

    if (data) {
      setMyChats(data);
      checkUnreadMessages(data);
    }
  };

  const fetchMessages = async (chatId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const sendEmailNotification = async (targetEmail: string, subject: string, text: string) => {
    if (!targetEmail || !targetEmail.includes('@')) return;
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject,
          text,
        }),
      });
    } catch (err) {
      console.error('Email notification failed:', err);
    }
  };

  const handleOpenOrCreateChat = async (sellerToken: string, bookTitleForNotice?: string, targetSellerName?: string) => {
    if (!sellerToken || sellerToken === mySellerToken) {
      alert('ご自身の出品物です。');
      return;
    }

    try {
      const { data: existingChats } = await supabase
        .from('chats')
        .select('*')
        .or(`buyer_token.eq.${mySellerToken},seller_token.eq.${mySellerToken}`);

      const matchedChat = existingChats?.find(
        (c) =>
          (c.buyer_token === mySellerToken && c.seller_token === sellerToken) ||
          (c.buyer_token === sellerToken && c.seller_token === mySellerToken)
      );

      if (matchedChat) {
        setActiveChat(matchedChat);
        return;
      }

      const matchedBook = books.find(b => b.seller_token === sellerToken);
      const actualSellerName = targetSellerName || matchedBook?.seller_name || myleakedNameFix(sellerToken) || '出品者';
      const myEmail = localStorage.getItem('my_notification_email') || '';
      const sellerEmail = matchedBook?.seller_email || '';

      const { data: newChat, error } = await supabase
        .from('chats')
        .insert([
          {
            buyer_token: mySellerToken,
            buyer_name: myNickname || '購入希望者',
            seller_token: sellerToken,
            seller_name: actualSellerName,
            buyer_email: myEmail,
            seller_email: sellerEmail,
          },
        ])
        .select()
        .single();

      if (error) {
        alert('チャットルームの作成に失敗しました: ' + error.message);
        return;
      }

      if (newChat) {
        setActiveChat(newChat);
        fetchMyChats();

        if (bookTitleForNotice) {
          const noticeTitle = '💬 新しいお問い合わせ';
          const noticeBody = `${myNickname || '購入希望者'} さんから「${bookTitleForNotice}」についてチャットが届きました！`;

          await supabase.from('notifications').insert([
            {
              user_token: sellerToken,
              title: noticeTitle,
              body: noticeBody,
              chat_id: newChat.id,
            },
          ]);

          if (sellerEmail) {
            await sendEmailNotification(
              sellerEmail,
              `【キャンパスフリマ】${noticeTitle}`,
              `${noticeBody}\n\nアプリを開いて確認・返信してください！`
            );
          }
        }
      }
    } catch (err: any) {
      alert('チャット作成エラー: ' + (err.message || err));
    }
  };

  const myleakedNameFix = (token: string) => {
    const b = books.find(item => item.seller_token === token);
    return b ? b.seller_name : null;
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = confirm('このチャットルームを削除しますか？（※メッセージのやり取りも削除されます）');
    if (!confirmDelete) return;

    const { error } = await supabase.from('chats').delete().eq('id', chatId);
    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      const updatedUnreadMap = { ...unreadChatMap };
      delete updatedUnreadMap[chatId];
      setUnreadChatMap(updatedUnreadMap);

      const updatedReadMap = { ...readTimestamps };
      delete updatedReadMap[chatId];
      setReadTimestamps(updatedReadMap);
      localStorage.setItem('chat_read_timestamps', JSON.stringify(updatedReadMap));

      setMyChats(myChats.filter(c => c.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
      }
      alert('チャットを削除しました');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeChat) return;

    const content = newMessageText.trim();
    setNewMessageText('');

    const { error } = await supabase.from('messages').insert([
      {
        chat_id: activeChat.id,
        sender_token: mySellerToken,
        sender_name: myNickname || 'ユーザー',
        content: content,
      },
    ]);

    if (error) {
      alert('送信に失敗しました: ' + error.message);
      return;
    }

    const isBuyerSending = activeChat.buyer_token === mySellerToken;
    const recipientToken = isBuyerSending ? activeChat.seller_token : activeChat.buyer_token;
    const recipientEmail = isBuyerSending ? activeChat.seller_email : activeChat.buyer_email;

    const noticeTitle = `💬 ${myNickname || 'お相手'} さんからのメッセージ`;
    const noticeBody = content.length > 20 ? content.substring(0, 20) + '...' : content;

    await supabase.from('notifications').insert([
      {
        user_token: recipientToken,
        title: noticeTitle,
        body: noticeBody,
        chat_id: activeChat.id,
      },
    ]);

    if (recipientEmail) {
      await sendEmailNotification(
        recipientEmail,
        `【キャンパスフリマ】${noticeTitle}`,
        `【新着メッセージ】\n\n${myNickname || 'お相手'}さんからメッセージが届きました：\n「${content}」\n\nアプリを開いて確認・返信してください！`
      );
    }
  };

  const handleOpenModal = (book: Book) => {
    setSelectedBook(book);
    if (book.id) {
      setSelectedBundleBookIds([book.id]);
    } else {
      setSelectedBundleBookIds([]);
    }
  };

  const addMyBookId = (id: number) => {
    const updated = [...myBookIds, id];
    setMyBookIds(updated);
    localStorage.setItem('my_book_ids', JSON.stringify(updated));
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
      };
    });
  };

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイル（JPEGやPNGなど）のみアップロード可能です。');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズが大きすぎます（5MB以下にしてください）。');
      return;
    }

    const compressed = await compressImage(file);
    setImageFile(compressed);

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(compressed);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0] && files[0].type.startsWith('image/')) {
      processImageFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      processImageFile(file);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('book-images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('book-images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error: any) {
      alert('画像のアップロードに失敗しました: ' + error.message);
      return null;
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = newTitle.trim();
    const priceNum = Number(newPrice);

    try {
      const lastPostTime = localStorage.getItem('last_post_timestamp');
      if (lastPostTime) {
        const elapsed = Date.now() - Number(lastPostTime);
        if (elapsed < 30000) {
          const remainingSec = Math.ceil((30000 - elapsed) / 1000);
          alert(`⏳ 連続での出品は制限されています。あと ${remainingSec} 秒お待ちください。`);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (trimmedTitle.length < 3) {
      alert('❌ 教科書名は3文字以上で具体的に入力してください。');
      return;
    }

    const lowerTitle = trimmedTitle.toLowerCase();
    const foundNgWord = NG_WORDS.find(word => lowerTitle.includes(word.toLowerCase()));
    if (foundNgWord) {
      alert('❌ 教科書名に使用できない不適切な言葉が含まれています。');
      return;
    }

    if (isNaN(priceNum) || priceNum < 100 || priceNum > 10000) {
      alert('❌ 価格は 100円 から 10,000円 の間で正しく入力してください。');
      return;
    }
    if (!agreeTerms) {
      alert('❌ 利用規約への同意が必要です。');
      return;
    }

    if (!imageFile) {
      const proceedWithoutImage = confirm(
        '画像が選択されていません。\n写真はけると購入されやすくなりますが、このまま画像なしで出品しますか？'
      );
      if (!proceedWithoutImage) return;
    }

    setUploading(true);

    let imageUrl = '';
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    const actualSellerName = myNickname && myNickname !== '出品者' ? myNickname : '学生';
    const myEmail = localStorage.getItem('my_notification_email') || '';

    const { data, error } = await supabase.from('books').insert([
      {
        title: trimmedTitle,
        price: priceNum,
        status: newStatus,
        image_url: imageUrl,
        status_type: 'active',
        report_count: 0,
        like_count: 0,
        is_hidden: false,
        seller_token: mySellerToken,
        seller_name: actualSellerName,
        seller_email: myEmail,
      },
    ]).select();

    setUploading(false);

    if (error) {
      alert('出品に失敗しました: ' + error.message);
    } else {
      localStorage.setItem('last_post_timestamp', Date.now().toString());
      alert('教科書を出品しました！');
      if (data && data[0] && data[0].id) {
        addMyBookId(data[0].id);
      }
      setNewTitle('');
      setNewPrice('');
      setAgreeTerms(false);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowAddModal(false);
      fetchBooks();
    }
  };

  const handleToggleLike = async (book: Book, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!book.id) return;

    const isLiked = likedBookIds.includes(book.id);
    const newLikedIds = isLiked
      ? likedBookIds.filter((id) => id !== book.id)
      : [...likedBookIds, book.id];

    const newCount = Math.max(0, (book.like_count || 0) + (isLiked ? -1 : 1));

    const { error } = await supabase
      .from('books')
      .update({ like_count: newCount })
      .eq('id', book.id);

    if (!error) {
      setLikedBookIds(newLikedIds);
      localStorage.setItem('liked_book_ids', JSON.stringify(newLikedIds));
      setBooks(books.map(b => b.id === book.id ? { ...b, like_count: newCount } : b));
      if (selectedBook && selectedBook.id === book.id) {
        setSelectedBook({ ...selectedBook, like_count: newCount });
      }
    }
  };

  const handleStartBundleNegotiation = async () => {
    if (!selectedBook || !selectedBook.seller_token) return;

    if (selectedBundleBookIds.length === 0) {
      alert('購入する商品を1冊以上選択してください。');
      return;
    }

    const targetBooks = books.filter(b => b.id && selectedBundleBookIds.includes(b.id));
    const totalPrice = targetBooks.reduce((sum, b) => sum + (b.price || 0), 0);

    const agreeBuyTerms = confirm(
      `【まとめ買い購入の確認】\n\n選択した ${targetBooks.length} 冊（合計 ¥${totalPrice.toLocaleString()}）の取引交渉を開始します。\n\n※「OK」を押すと利用規約に同意したとみなし、アプリ内チャットが開きます。`
    );
    if (!agreeBuyTerms) return;

    const nowIso = new Date().toISOString();

    for (const bookId of selectedBundleBookIds) {
      await supabase
        .from('books')
        .update({ 
          status_type: 'negotiating',
          negotiated_at: nowIso,
          negotiator_token: mySellerToken,
          negotiator_name: myNickname || '購入希望者',
        })
        .eq('id', bookId);
    }

    const currentSellerToken = selectedBook.seller_token;
    const currentBookTitle = selectedBook.title;
    const currentSellerName = selectedBook.seller_name;
    
    setSelectedBook(null);
    await fetchBooks();
    await handleOpenOrCreateChat(currentSellerToken, currentBookTitle, currentSellerName);
  };

  const handleCompleteBundleSale = async () => {
    if (!selectedBook) return;
    const isMyBook = (selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken);

    if (!isMyBook && !isAdminMode) {
      alert('取引を完了できるのは出品者のみです。');
      return;
    }

    if (selectedBundleBookIds.length === 0) {
      alert('完了にする商品を1冊以上選択してください。');
      return;
    }

    const targetBooks = books.filter(b => b.id && selectedBundleBookIds.includes(b.id));
    const bookTitlesText = targetBooks.map(b => `・${b.title}`).join('\n');
    
    const confirmComplete = confirm(`以下の ${targetBooks.length} 冊の取引をすべて完了（売り切れ）にしますか？\n\n${bookTitlesText}\n（※完了から1週間後に自動で一覧から非表示になります）`);
    if (!confirmComplete) return;

    const nowIso = new Date().toISOString();

    for (const bookId of selectedBundleBookIds) {
      await supabase
        .from('books')
        .update({ 
          status_type: 'sold',
          completed_at: nowIso 
        })
        .eq('id', bookId);
    }

    alert('選択したすべての本の取引を完了にしました！ご利用ありがとうございました🎉');
    setSelectedBook(null);
    fetchBooks();
  };

  const handleCancelBundleNegotiation = async () => {
    if (!selectedBook) return;
    const isMyBook = (selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken);
    const isMyNegotiation = selectedBook.negotiator_token === mySellerToken;

    let isWithin10Minutes = false;
    if (selectedBook.negotiated_at) {
      const negotiatedTime = new Date(selectedBook.negotiated_at).getTime();
      const currentTime = new Date().getTime();
      const diffMinutes = (currentTime - negotiatedTime) / (1000 * 60);
      if (!isNaN(diffMinutes) && diffMinutes <= 10) {
        isWithin10Minutes = true;
      }
    }

    if (!isMyBook && !isMyNegotiation && !isAdminMode) {
      alert('交渉をキャンセルできるのは、ご自身の交渉または出品者のみです。');
      return;
    }

    if (!isWithin10Minutes && !isMyBook && !isAdminMode) {
      alert('⏳ 交渉開始から10分以上経過しているため、直接キャンセルすることができません。\n\nお手数ですが、取引チャットにて出品者にその旨（キャンセルしたいこと）をお伝えください。');
      return;
    }

    if (selectedBundleBookIds.length === 0) {
      alert('キャンセルする商品を1冊以上選択してください。');
      return;
    }

    const targetBooks = books.filter(b => b.id && selectedBundleBookIds.includes(b.id));
    const confirmCancel = confirm(`選択された ${targetBooks.length} 冊の交渉をキャンセルし、出品中に戻しますか？`);
    if (!confirmCancel) return;

    for (const bookId of selectedBundleBookIds) {
      await supabase
        .from('books')
        .update({ 
          status_type: 'active',
          negotiated_at: null,
          completed_at: null,
          negotiator_token: null,
          negotiator_name: null,
        })
        .eq('id', bookId);
    }

    const recipientToken = isMyBook ? selectedBook.negotiator_token : selectedBook.seller_token;
    if (recipientToken) {
      const noticeTitle = '⚠️ 取引交渉のキャンセル';
      const noticeBody = `${myNickname || 'お相手'} さんにより「${selectedBook.title}」の取引交渉がキャンセルされ、出品中に戻りました。`;

      await supabase.from('notifications').insert([
        {
          user_token: recipientToken,
          title: noticeTitle,
          body: noticeBody,
        },
      ]);

      const matchedChat = myChats.find(c => c.buyer_token === recipientToken || c.seller_token === recipientToken);
      const recipientEmail = matchedChat ? (matchedChat.buyer_token === recipientToken ? matchedChat.buyer_email : matchedChat.seller_email) : '';
      if (recipientEmail) {
        await sendEmailNotification(
          recipientEmail,
          `【キャンパスフリマ】${noticeTitle}`,
          `${noticeBody}\n\nアプリを開いてご確認ください。`
        );
      }
    }

    alert('選択したすべての本を出品中に戻しました！');
    setSelectedBook(null);
    await fetchBooks();
  };

  const handleReport = async (book: Book) => {
    const targetKey = book.id || book.title;
    if (!targetKey) {
      alert('商品情報が正しく読み込まれていません');
      return;
    }

    const isReported = reportedBookIds.includes(targetKey);
    if (isReported) {
      alert('⚠️ あなたはこの商品をすでに通報済みです。（同一商品への連続通報はできません）');
      return;
    }

    const reason = prompt(
      `「${book.title}」の通報理由を選んで入力してください:\n\n1: 不適切な画像・表現\n2: 価格や説明文が不審・イタズラ\n3: その他規約違反`,
      '1'
    );
    if (!reason) return;

    const confirmReport = confirm('この内容で運営に通報しますか？');
    if (!confirmReport) return;

    const newCount = (book.report_count || 0) + 1;
    const shouldHide = newCount >= 3;

    const { error } = await supabase
      .from('books')
      .update({ 
        report_count: newCount,
        is_hidden: shouldHide 
      })
      .eq('id', book.id);

    if (error) {
      alert('通報に失敗しました: ' + error.message);
    } else {
      const updatedReportIds = [...reportedBookIds, targetKey];
      setReportedBookIds(updatedReportIds);
      localStorage.setItem('reported_book_ids', JSON.stringify(updatedReportIds));

      if (shouldHide) {
        alert('通報を受け付けました。この商品は安全のため自動非表示となりました。');
      } else {
        alert('ご協力ありがとうございます。通報を受け付けました。');
      }
      setSelectedBook(null);
      fetchBooks();
    }
  };

  const handleDelete = async (book: Book) => {
    const isMyBook = (book.id && myBookIds.includes(book.id)) || (book.seller_token === mySellerToken);

    if (!isMyBook && !isAdminMode) {
      alert('商品を削除できるのは出品者または管理者のみです。');
      return;
    }

    const confirmDelete = confirm(`「${book.title}」を本当に削除しますか？`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', book.id);

    if (error) {
      alert('削除に失敗しました: ' + error.message);
    } else {
      alert('商品を削除しました');
      setSelectedBook(null);
      fetchBooks();
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteBookIds.length === 0) {
      alert('削除する商品が選択されていません。');
      return;
    }

    const confirmBulk = confirm(`選択した ${bulkDeleteBookIds.length} 冊の商品を本当に削除しますか？`);
    if (!confirmBulk) return;

    for (const bookId of bulkDeleteBookIds) {
      await supabase.from('books').delete().eq('id', bookId);
    }

    const updatedMyBookIds = myBookIds.filter(id => !bulkDeleteBookIds.includes(id));
    setMyBookIds(updatedMyBookIds);
    localStorage.setItem('my_book_ids', JSON.stringify(updatedMyBookIds));

    alert('選択した商品をすべて削除しました！');
    setBulkDeleteBookIds([]);
    setIsBulkDeleteMode(false);
    fetchBooks();
  };

  const handleToggleAdmin = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      alert('管理者モードをオフにしました');
    } else {
      const inputPass = prompt('管理者パスコードを入力してください:');
      if (inputPass === ADMIN_PASSCODE) {
        setIsAdminMode(true);
        alert('管理者モードをオンにしました');
      } else {
        alert('パスコードが違います');
      }
    }
  };

  const filteredBooks = books
    .filter((book) => {
      if (book.is_hidden) return false;
      const statusType = book.status_type || 'active';
      const isMyBook = (book.id && myBookIds.includes(book.id)) || (book.seller_token === mySellerToken);

      if (activeTab === 'active') {
        if (statusType !== 'active') return false;
      } else if (activeTab === 'negotiating') {
        if (statusType !== 'negotiating') return false;
      } else if (activeTab === 'sold') {
        if (statusType !== 'sold') return false;
      } else if (activeTab === 'liked') {
        if (!book.id || !likedBookIds.includes(book.id)) return false;
      } else if (activeTab === 'mine') {
        if (!isMyBook) return false;
      }

      return (book.title || '').toLowerCase().includes(searchWord.toLowerCase());
    })
    .sort((a, b) => {
      const aSold = a.status_type === 'sold' ? 1 : 0;
      const bSold = b.status_type === 'sold' ? 1 : 0;

      if (aSold !== bSold) return aSold - bSold;

      if (sortBy === 'price-asc') {
        return (a.price || 0) - (b.price || 0);
      } else if (sortBy === 'price-desc') {
        return (b.price || 0) - (a.price || 0);
      } else {
        return (b.id || 0) - (a.id || 0);
      }
    });

  const negotiatingCount = books.filter(b => b.status_type === 'negotiating' && !b.is_hidden).length;
  const activeCount = books.filter(b => b.status_type === 'active' && !b.is_hidden).length;
  const soldCount = books.filter(b => b.status_type === 'sold' && !b.is_hidden).length;
  const myCount = books.filter(b => ((b.id && myBookIds.includes(b.id)) || (b.seller_token === mySellerToken)) && !b.is_hidden).length;
  const unreadNotificationsCount = notifications.filter(n => !n.is_read).length;
  const totalUnreadChatsCount = Object.values(unreadChatMap).filter(Boolean).length;

  const selectedBundleBooks = books.filter(b => b.id && selectedBundleBookIds.includes(b.id));
  const bundleTotalPrice = selectedBundleBooks.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <main className="w-full px-3 py-4 space-y-5 text-gray-900 dark:text-gray-100 text-base font-sans pb-24" onPaste={handlePaste}>
      {/* スマホ優先ヘッダー */}
      <div className="space-y-3 border-b-2 border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-900 dark:text-blue-400">学内教科書フリマ</h1>
            <p className="text-sm font-bold text-blue-600 dark:text-blue-300 mt-0.5">👤 {myNickname || '未設定'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowMyPageModal(true)}
            className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-3.5 py-2 rounded-xl text-sm font-black shadow-sm"
          >
            👤 マイページ
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(true);
              markNotificationsAsRead();
            }}
            className="relative text-sm bg-gray-100 dark:bg-gray-800 font-bold py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 flex items-center justify-center gap-1"
          >
            🔔 通知
            {unreadNotificationsCount > 0 && (
              <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-black">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowChatList(true);
              fetchMyChats();
            }}
            className="relative text-sm bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold py-2.5 rounded-xl border border-blue-300 dark:border-blue-800 flex items-center justify-center gap-1 col-span-2"
          >
            💬 メッセージ ({myChats.length})
            {totalUnreadChatsCount > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-black animate-bounce">
                {totalUnreadChatsCount} 未読
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowQA(true)}
            className="text-sm text-amber-800 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 text-center"
          >
            ❓ Q&A
          </button>
          
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-sm text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800 text-center"
          >
            📄 規約
          </button>
          
          <button
            type="button"
            onClick={handleToggleAdmin}
            className={`text-sm py-2.5 rounded-xl font-bold border text-center transition ${
              isAdminMode ? 'bg-red-600 text-white border-red-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-300'
            }`}
          >
            {isAdminMode ? '🔧 管理中' : '⚙️ 管理'}
          </button>
        </div>
      </div>

      {/* メール通知促進バナー */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-2xl shadow flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="bg-amber-400 text-slate-900 text-xs font-black px-2 py-0.5 rounded inline-block">
            便利機能
          </span>
          <p className="font-bold text-sm">✉️ 取引メール通知</p>
        </div>
        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          className="bg-white text-blue-700 font-black text-xs px-3.5 py-2.5 rounded-xl shadow transition whitespace-nowrap"
        >
          設定する ＞
        </button>
      </div>

      {/* 📊 管理者専用アナリティクス */}
      {isAdminMode && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-red-500 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-2.5">
            <h3 className="text-xs font-bold text-red-400">📊 【管理者限定】アクセスアナリティクス</h3>
            <button
              type="button"
              onClick={handleRefreshAnalytics}
              disabled={isRefreshingAnalytics}
              className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold"
            >
              🔄 更新
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800 p-2.5 rounded-xl">
              <p className="text-xs text-slate-400 font-bold">今日</p>
              <p className="text-lg font-black text-blue-400">{analytics.today.toLocaleString()} PV</p>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl">
              <p className="text-xs text-slate-400 font-bold">今月</p>
              <p className="text-lg font-black text-emerald-400">{analytics.thisMonth.toLocaleString()} PV</p>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl">
              <p className="text-xs text-slate-400 font-bold">累計</p>
              <p className="text-lg font-black text-amber-400">{analytics.total.toLocaleString()} PV</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">📈 PV推移グラフ</span>
              <div className="flex bg-slate-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setChartViewMode('daily')}
                  className={`text-xs px-2 py-0.5 rounded-md font-bold ${chartViewMode === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  日別 (30日)
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('monthly')}
                  className={`text-xs px-2 py-0.5 rounded-md font-bold ${chartViewMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                >
                  月別 (24ヶ月)
                </button>
              </div>
            </div>

            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartViewMode === 'daily' ? dailyChartData : monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Bar dataKey="pv" name="PV数" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 初回ニックネーム登録モーダル */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl w-full space-y-5 text-gray-900 dark:text-gray-100 shadow-2xl border-2 border-blue-500">
            <h2 className="text-2xl font-black text-blue-900 dark:text-blue-400">👋 はじめまして！</h2>
            <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed font-bold">
              取引やチャットで表示される<strong>アカウント名（ニックネーム）</strong>を入力してください。
            </p>
            <form onSubmit={handleSaveNickname} className="space-y-4">
              <input
                type="text"
                placeholder="例: 文学部 太郎"
                value={tempNicknameInput}
                onChange={(e) => setTempNicknameInput(e.target.value)}
                className="w-full border-2 p-4 text-lg rounded-2xl font-bold outline-none focus:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                maxLength={20}
                autoFocus
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow transition"
              >
                決定してはじめる
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ポップアップ広告モーダル */}
      {showPopupAd && activePopupAd && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden max-w-sm w-full space-y-4 p-5 relative border-2 border-amber-400 shadow-2xl text-gray-900 dark:text-gray-100">
            <button
              type="button"
              onClick={() => setShowPopupAd(false)}
              className="absolute top-3 right-3 bg-black/50 text-white font-black w-8 h-8 rounded-full flex items-center justify-center z-10"
            >
              ✕
            </button>
            <span className="bg-amber-400 text-slate-900 text-xs font-black px-2.5 py-1 rounded-md inline-block">
              {activePopupAd.tag}
            </span>
            <div className="h-40 rounded-2xl overflow-hidden bg-gray-100">
              <img src={activePopupAd.image} alt="Ad" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-lg leading-snug">{activePopupAd.catchcopy}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">{activePopupAd.description}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPopupAd(false)}
              className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl text-base shadow"
            >
              フリマを利用する
            </button>
          </div>
        </div>
      )}

      {/* 📌 画面右下の固定「出品する」ボタン */}
      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black px-6 py-4 rounded-full shadow-2xl z-40 flex items-center gap-2 text-lg border-2 border-white/20 transition transform hover:scale-105 active:scale-95"
      >
        <span className="text-2xl leading-none">＋</span> 出品する
      </button>

      {/* 📦 出品モーダル画面 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 relative shadow-2xl border-2 border-blue-500">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 bg-gray-100 dark:bg-gray-800 font-black w-9 h-9 rounded-full flex items-center justify-center text-lg text-gray-700 dark:text-gray-200"
            >
              ✕
            </button>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">📚 教科書を出品する</h2>

            <form onSubmit={handleAddBook} className="space-y-4">
              <div>
                <label className="block text-base font-bold mb-1">教科書名（3文字以上）</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: ミクロ経済学"
                  className="w-full border-2 p-3.5 rounded-2xl bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-base font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-base font-bold mb-1">価格 (円)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="1000"
                    min="100"
                    max="10000"
                    className="w-full border-2 p-3.5 rounded-2xl bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-base font-bold"
                  />
                </div>
                <div>
                  <label className="block text-base font-bold mb-1">状態</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full border-2 p-3.5 rounded-2xl bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-base font-bold"
                  >
                    <option value="新品・未使用">新品・未使用</option>
                    <option value="目立った傷なし">目立った傷なし</option>
                    <option value="書き込みあり">書き込みあり</option>
                    <option value="汚れている">汚れている</option>
                  </select>
                </div>
              </div>

              {/* 画像エリア */}
              <div>
                <label className="block text-base font-bold mb-1">教科書画像（任意）</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed p-4 rounded-2xl text-center transition ${
                    isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {imagePreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-2xl shadow" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-sm text-red-500 font-bold underline"
                      >
                        やり直す
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 font-bold">画像をドラッグ＆ドロップ または コピペ（Ctrl+V）可</p>
                      <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="text-sm font-bold w-full" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-300 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="agreeTermsModal"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-6 h-6 text-blue-600 rounded"
                />
                <label htmlFor="agreeTermsModal" className="text-sm text-gray-800 dark:text-gray-200 font-bold cursor-pointer">
                  <button type="button" onClick={() => setShowTerms(true)} className="text-blue-600 underline font-black">規約</button>に同意して出品
                </label>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black disabled:bg-gray-400 text-lg shadow-md"
              >
                {uploading ? '出品中...' : '出品を完了する'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 👤 マイページ モーダル */}
      {showMyPageModal && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full p-4 overflow-y-auto space-y-6">
          <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-3 flex-shrink-0">
            <h2 className="text-xl font-black">👤 マイページ</h2>
            <button type="button" onClick={() => setShowMyPageModal(false)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          <div className="space-y-5 flex-1">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-3xl border-2 border-blue-200 dark:border-blue-800 space-y-3">
              <p className="text-xs font-black text-blue-600 dark:text-blue-300">アカウント情報</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500 font-bold">現在の名前</p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-100">{myNickname || '未設定'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleNameChangeInMyPage}
                  className="bg-blue-600 text-white text-sm font-black px-4 py-2.5 rounded-xl shadow"
                >
                  ✏️ 名前を変更
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-center space-y-1">
                <p className="text-xs text-gray-500 font-bold">自分の出品</p>
                <p className="text-2xl font-black text-blue-600">{myCount} 冊</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-center space-y-1">
                <p className="text-xs text-gray-500 font-bold">お気に入り</p>
                <p className="text-2xl font-black text-pink-600">{likedBookIds.length} 冊</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black text-gray-400">クイックメニュー</p>
              <button
                type="button"
                onClick={() => {
                  setShowMyPageModal(false);
                  setActiveTab('mine');
                }}
                className="w-full text-left p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold flex justify-between items-center border border-gray-200 dark:border-gray-700"
              >
                <span>📦 自分の出品リスト・一括管理</span>
                <span className="text-blue-600">＞</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMyPageModal(false);
                  setActiveTab('liked');
                }}
                className="w-full text-left p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold flex justify-between items-center border border-gray-200 dark:border-gray-700"
              >
                <span>❤️ お気に入り一覧</span>
                <span className="text-blue-600">＞</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMyPageModal(false);
                  setShowEmailModal(true);
                }}
                className="w-full text-left p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 font-bold flex justify-between items-center border border-gray-200 dark:border-gray-700"
              >
                <span>✉️ 取引メール通知設定</span>
                <span className="text-blue-600">＞</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 一覧＆検索 */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black">教科書を探す</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border-2 p-2 rounded-xl bg-white dark:bg-gray-800 font-bold text-sm"
          >
            <option value="newest">新着順</option>
            <option value="price-asc">安い順</option>
            <option value="price-desc">高い順</option>
          </select>
        </div>

        {/* タブ */}
        <div className="flex border-b-2 border-gray-200 dark:border-gray-800 overflow-x-auto pb-1 gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('all'); setIsBulkDeleteMode(false); }}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'all' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('active'); setIsBulkDeleteMode(false); }}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            出品中 ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('negotiating'); setIsBulkDeleteMode(false); }}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'negotiating' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500'
            }`}
          >
            交渉中 ({negotiatingCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('sold'); setIsBulkDeleteMode(false); }}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'sold' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'
            }`}
          >
            売切 ({soldCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('liked'); setIsBulkDeleteMode(false); }}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'liked' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500'
            }`}
          >
            ❤️ ({likedBookIds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`py-2.5 px-3.5 text-base font-black border-b-4 transition whitespace-nowrap ${
              activeTab === 'mine' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
            }`}
          >
            自分の出品 ({myCount})
          </button>
        </div>

        {/* 自分の出品タブのときの一括削除ボタン */}
        {activeTab === 'mine' && myCount > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 border-2 p-3.5 rounded-2xl flex justify-between items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBulkDeleteMode(!isBulkDeleteMode);
                setBulkDeleteBookIds([]);
              }}
              className={`text-sm font-black px-4 py-2.5 rounded-xl border-2 ${
                isBulkDeleteMode ? 'bg-red-100 text-red-700 border-red-400' : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              {isBulkDeleteMode ? '✕ 一括削除を終了' : '☑️ まとめて削除'}
            </button>

            {isBulkDeleteMode && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const myBooks = books.filter(b => (b.id && myBookIds.includes(b.id)) || (b.seller_token === mySellerToken));
                    const allMineIds = myBooks.map(b => b.id).filter(Boolean) as number[];
                    if (bulkDeleteBookIds.length === allMineIds.length) {
                      setBulkDeleteBookIds([]);
                    } else {
                      setBulkDeleteBookIds(allMineIds);
                    }
                  }}
                  className="text-sm bg-white text-blue-600 px-3 py-2 rounded-xl border font-bold"
                >
                  全選択
                </button>
                <button
                  type="button"
                  disabled={bulkDeleteBookIds.length === 0}
                  onClick={handleBulkDelete}
                  className="text-sm bg-red-600 text-white px-4 py-2 rounded-xl font-bold disabled:bg-gray-300"
                >
                  選択した {bulkDeleteBookIds.length} 冊を削除
                </button>
              </div>
            )}
          </div>
        )}

        <input
          type="text"
          placeholder="教科書名で検索..."
          value={searchWord}
          onChange={(e) => setSearchWord(e.target.value)}
          className="w-full border-2 p-3.5 rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 text-base font-bold"
        />

        {loading ? (
          <p className="text-center text-gray-500 py-8 font-bold text-base">読み込み中...</p>
        ) : filteredBooks.length === 0 ? (
          <p className="text-gray-500 text-center py-8 font-bold text-base">該当する教科書がありません</p>
        ) : (
          <div className="space-y-3">
            {filteredBooks.map((book) => {
              const isMyBook = (book.id && myBookIds.includes(book.id)) || (book.seller_token === mySellerToken);
              const statusType = book.status_type || 'active';
              const isLiked = book.id ? likedBookIds.includes(book.id) : false;
              const isBulkChecked = book.id ? bulkDeleteBookIds.includes(book.id) : false;

              return (
                <div
                  key={book.id || book.title}
                  onClick={() => {
                    if (isBulkDeleteMode && isMyBook && book.id) {
                      if (isBulkChecked) {
                        setBulkDeleteBookIds(bulkDeleteBookIds.filter(id => id !== book.id));
                      } else {
                        setBulkDeleteBookIds([...bulkDeleteBookIds, book.id]);
                      }
                    } else {
                      handleOpenModal(book);
                    }
                  }}
                  className={`border-2 p-3.5 rounded-2xl flex gap-3.5 items-center cursor-pointer shadow-sm border-gray-200 dark:border-gray-800 ${
                    statusType === 'sold' ? 'bg-gray-100 opacity-70' : 'bg-white dark:bg-gray-800'
                  } ${isBulkDeleteMode && isMyBook && isBulkChecked ? 'border-red-500 bg-red-50/30' : ''}`}
                >
                  {isBulkDeleteMode && isMyBook && (
                    <input
                      type="checkbox"
                      checked={isBulkChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!book.id) return;
                        if (e.target.checked) {
                          setBulkDeleteBookIds([...bulkDeleteBookIds, book.id]);
                        } else {
                          setBulkDeleteBookIds(bulkDeleteBookIds.filter(id => id !== book.id));
                        }
                      }}
                      className="w-6 h-6 text-red-600 rounded flex-shrink-0"
                    />
                  )}

                  <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {book.image_url ? (
                      <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400 font-bold">画像なし</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-black text-lg text-gray-900 dark:text-gray-100 truncate">{book.title}</h3>
                      {statusType === 'sold' && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded font-black">SOLD</span>}
                      {statusType === 'negotiating' && <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded font-black">交渉中</span>}
                    </div>
                    <p className="text-xs text-gray-500 font-bold">状態: {book.status}</p>
                    <p className="text-xs text-gray-400 font-bold">出品者: {book.seller_name || '学生'}</p>

                    <button
                      type="button"
                      onClick={(e) => handleToggleLike(book, e)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-black mt-1 ${
                        isLiked ? 'bg-pink-50 text-pink-600 border-pink-300' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {isLiked ? '❤️ 済' : '🤍 お気に入り'} {book.like_count || 0}
                    </button>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-black text-red-600">¥{(book.price || 0).toLocaleString()}</p>
                    <span className="text-xs font-bold text-blue-600">{isBulkDeleteMode && isMyBook ? '選択' : '詳細 ＞'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* スマホ画面いっぱいに広がる取引チャット画面 */}
      {activeChat && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full">
          <div className="p-4 border-b-2 border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <div>
              <h3 className="font-black text-xl">💬 取引チャット</h3>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                相手: {activeChat.buyer_token === mySellerToken ? activeChat.seller_name || '出品者' : activeChat.buyer_name || '購入者'}
              </p>
            </div>
            <button type="button" onClick={() => setActiveChat(null)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 p-3 border-b-2 border-amber-200 flex items-center justify-between gap-2 flex-shrink-0">
            <span className="text-sm font-black text-amber-900 dark:text-amber-200">💡 テンプレート文</span>
            <button
              type="button"
              onClick={() => {
                const targetBooks = books.filter(b => (b.seller_token === activeChat.seller_token || b.negotiator_token === mySellerToken) && b.status_type === 'negotiating');
                const titles = targetBooks.length > 0
                  ? targetBooks.map(b => `・${b.title} (¥${b.price.toLocaleString()})`).join('\n')
                  : `・教科書`;
                const total = targetBooks.reduce((sum, b) => sum + b.price, 0);
                const template = `学内教科書フリマを見て連絡しました！以下の商品をまとめて購入・交渉希望です。\n\n${titles}\n\n${total > 0 ? `【合計金額】 ¥${total.toLocaleString()}\n\n` : ''}学内の受け渡し場所とご都合の良い日時についてご相談させてください。よろしくお願いいたします！`;
                setNewMessageText(template);
              }}
              className="bg-amber-600 text-white text-sm font-black px-4 py-2 rounded-xl shadow"
            >
              セットする
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-100 dark:bg-gray-950">
            {messages.length === 0 ? (
              <p className="text-center text-base text-gray-400 py-12 font-bold">メッセージを入力するかテンプレートをセットして送信してください！</p>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_token === mySellerToken;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500 font-extrabold mb-1 px-1">{isMe ? '自分' : msg.sender_name || 'お相手'}</span>
                    <div className={`max-w-[90%] p-4 rounded-2xl text-base sm:text-lg font-medium leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-br-none shadow' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow'}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span className={`text-xs block mt-2 text-right font-bold ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2 flex-shrink-0">
            <input
              type="text"
              placeholder="メッセージを入力..."
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className="flex-1 border-2 border-gray-300 dark:border-gray-700 p-3.5 text-base rounded-2xl outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 font-bold"
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl text-base font-black shadow">
              送信
            </button>
          </form>
        </div>
      )}

      {/* Q&A モーダル */}
      {showQA && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full p-4 overflow-y-auto space-y-5">
          <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-3 flex-shrink-0">
            <h2 className="text-xl font-black">❓ よくある質問（Q&A）</h2>
            <button type="button" onClick={() => setShowQA(false)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          <div className="space-y-4 text-base font-medium flex-1">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-black text-lg text-blue-600">Q. 利用料金や手数料はかかりますか？</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">A. 完全無料です。登録料・手数料・出品費用などは一切発生しません。キャンパス内手渡しのため送料も無料です。</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-black text-lg text-blue-600">Q. 取引の手順はどうなりますか？</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">A. 欲しい教科書の「交渉・購入する」をタップするとアプリ内チャットが開きます。チャットで学内の受け渡し場所や日時を決め、対面で現金と教科書を引き換えてください。</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-black text-lg text-blue-600">Q. 代金の支払い・受け渡し方法は？</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">A. キャンパス内で直接手渡しする際に、その場で現金でやり取りしてください。</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-black text-lg text-blue-600">Q. 交渉をキャンセルしたいときは？</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">A. 交渉開始から10分以内であれば、商品詳細画面から直接キャンセルできます。10分経過後は取引チャットで相手にキャンセルの旨をお伝えください。</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 space-y-1">
              <p className="font-black text-lg text-blue-600">Q. 不適切な商品や暴言を見つけた場合は？</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">A. 商品詳細画面の「🚩 違反通報」ボタンから通報できます。累計3回通報された商品は自動的に非表示となります。</p>
            </div>

            <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-800 text-center space-y-3">
              <p className="font-black text-base text-gray-800 dark:text-gray-200">
                💬 解決しないトラブル・ご質問・バグ報告はこちら
              </p>
              <a
                href="https://www.instagram.com/direct/t/wu_textbook_official/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:opacity-95 text-white font-black py-4 px-5 rounded-2xl text-base shadow-lg flex items-center justify-center gap-2 transition"
              >
                <span>📸 公式Instagram（@wu_textbook_official）へDMする</span>
              </a>
              <p className="text-xs font-bold text-gray-500">※タップするとInstagramアプリまたはブラウザが開きます</p>
            </div>
          </div>
        </div>
      )}

      {/* 利用規約 モーダル */}
      {showTerms && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full p-4 overflow-y-auto space-y-5">
          <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-3 flex-shrink-0">
            <h2 className="text-xl font-black">📄 利用規約・プライバシーポリシー</h2>
            <button type="button" onClick={() => setShowTerms(false)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          <div className="space-y-5 text-base leading-relaxed font-medium text-gray-800 dark:text-gray-200 flex-1">
            <div className="space-y-1">
              <p className="font-black text-lg text-blue-900 dark:text-blue-400">第1条（目的）</p>
              <p className="text-sm">本サービスは、同じキャンパスに通う学生同士が使わなくなった教科書・教材を無駄にせず手軽に売買・譲渡するための学内限定フリマ掲示板サービスです。</p>
            </div>

            <div className="space-y-1">
              <p className="font-black text-lg text-blue-900 dark:text-blue-400">第2条（禁止事項）</p>
              <p className="text-sm">ユーザーは、以下の行為を行ってはなりません。</p>
              <ul className="list-disc list-inside text-sm space-y-1 pl-2 text-gray-700 dark:text-gray-300">
                <li>教科書・教材以外の違法物、危険物、公序良俗に反するものの出品</li>
                <li>虚偽の教科書情報、価格、状態の掲載</li>
                <li>他者への暴言、誹謗中傷、嫌がらせ行為、スパム行為</li>
                <li>取引の意図がないイタズラ出品および購入申請</li>
                <li>法令または学内規則に違反する行為</li>
              </ul>
            </div>

            <div className="space-y-1">
              <p className="font-black text-lg text-blue-900 dark:text-blue-400">第3条（免責事項）</p>
              <p className="text-sm">1. 本サービスは学生同士の直接対面取引の場を提供するものであり、実際の売買・受け渡し・代金の支払い等に関するトラブルについて、運営は一切の責任を負いません。</p>
              <p className="text-sm">2. 教科書の状態や乱丁・落丁、代金の未払い等については当事者間で解決してください。</p>
            </div>

            <div className="space-y-1">
              <p className="font-black text-lg text-blue-900 dark:text-blue-400">第4条（利用停止・自動非表示）</p>
              <p className="text-sm">他のユーザーから累計3回以上の通報を受けた出品物は、安全保持のため自動的に非表示となります。また、悪質な違反行為が確認された場合、利用を制限することがあります。</p>
            </div>

            <div className="space-y-1 border-t pt-3 border-gray-200 dark:border-gray-800">
              <p className="font-black text-lg text-blue-900 dark:text-blue-400">🔒 プライバシーポリシー</p>
              <p className="text-sm">当サービスでは、ユーザー識別用トークンおよび設定されたニックネーム、メール通知設定時のアドレスを適切に管理し、取引通知およびサービス運営以外の目的で第三者に開示・提供することはありません。</p>
            </div>
          </div>
        </div>
      )}

      {/* メッセージ一覧 モーダル */}
      {showChatList && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full p-4 overflow-y-auto space-y-4">
          <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-black">💬 メッセージ一覧</h2>
            <button type="button" onClick={() => setShowChatList(false)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          {myChats.length === 0 ? (
            <p className="text-center text-base text-gray-500 py-12 font-bold">取引中のチャットはありません。</p>
          ) : (
            <div className="space-y-3">
              {myChats.map((chat) => {
                const isUnread = !!unreadChatMap[chat.id];
                const partnerName = chat.buyer_token === mySellerToken ? chat.seller_name || '出品者' : chat.buyer_name || '購入希望者';

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setShowChatList(false);
                      setActiveChat(chat);
                    }}
                    className={`p-4 border-2 rounded-2xl flex justify-between items-center cursor-pointer transition ${
                      isUnread ? 'bg-blue-50 dark:bg-blue-950 border-blue-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="space-y-1 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-base">{partnerName}</p>
                        {isUnread && (
                          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-black animate-pulse">
                            🔴 未読
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-bold">{new Date(chat.created_at).toLocaleString()}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="text-xs bg-red-100 text-red-600 px-3 py-2 rounded-xl font-bold hover:bg-red-200"
                      >
                        削除
                      </button>
                      <span className="bg-blue-600 text-white font-black text-sm px-4 py-2 rounded-xl">開く</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 通知一覧 モーダル */}
      {showNotifications && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col w-full h-full p-4 overflow-y-auto space-y-4">
          <div className="flex justify-between items-center border-b-2 border-gray-200 dark:border-gray-800 pb-3">
            <h2 className="text-xl font-black">🔔 お知らせ・通知</h2>
            <button type="button" onClick={() => setShowNotifications(false)} className="text-gray-500 font-black text-2xl p-2">✕ 閉じる</button>
          </div>

          {notifications.length === 0 ? (
            <p className="text-center text-base text-gray-500 py-12 font-bold">通知はありません。</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.chat_id) {
                      const targetChat = myChats.find(c => c.id === n.chat_id);
                      if (targetChat) {
                        setShowNotifications(false);
                        setActiveChat(targetChat);
                      } else {
                        setShowNotifications(false);
                        setShowChatList(true);
                      }
                    }
                  }}
                  className={`p-4 border-2 rounded-2xl bg-blue-50 dark:bg-blue-950 space-y-1 ${
                    n.chat_id ? 'cursor-pointer border-blue-300 hover:border-blue-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <p className="font-black text-base">{n.title}</p>
                    {n.chat_id && <span className="text-xs text-blue-600 font-black">チャットへ ＞</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* メール通知設定 モーダル */}
      <NotificationSettingsModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />

      {/* 🖼️ ライトボックス（画像の拡大表示モーダル） - z-indexを極めて高くして手前に表示 */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[999] cursor-pointer"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-12 right-0 text-white font-black text-lg bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full shadow-lg z-[1000]"
            >
              ✕ 閉じる
            </button>
            <img src={zoomImageUrl} alt="Zoomed" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20" />
          </div>
        </div>
      )}

      {/* 商品詳細 モーダル */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-gray-900 dark:text-gray-100 relative shadow-2xl border-2 border-gray-300 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 bg-gray-100 dark:bg-gray-800 font-black w-9 h-9 rounded-full flex items-center justify-center text-lg z-10 text-gray-700 dark:text-gray-200"
            >
              ✕
            </button>

            <h2 className="text-xl font-black pr-8">{selectedBook.title}</h2>

            {/* 画像エリア（タップで拡大） */}
            <div
              onClick={() => {
                if (selectedBook.image_url) {
                  setZoomImageUrl(selectedBook.image_url);
                }
              }}
              className="w-full h-56 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer relative border group"
            >
              {selectedBook.image_url ? (
                <>
                  <img src={selectedBook.image_url} alt={selectedBook.title} className="w-full h-full object-contain pointer-events-none" />
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-lg font-bold">🔍 タップで拡大</span>
                </>
              ) : (
                <span className="text-gray-400 font-bold text-base">画像なし</span>
              )}
            </div>

            <div className="flex justify-between items-center border-b pb-3">
              <span className="text-2xl font-black text-red-600">¥{(selectedBook.price || 0).toLocaleString()}</span>
              <span className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-xl font-bold">状態: {selectedBook.status}</span>
            </div>

            {/* 📚 出品者の他の商品（まとめ買い＆画像と選択部分を完全に分離） */}
            {selectedBook.seller_token && (
              <div className="space-y-2 border-t pt-3 border-gray-200 dark:border-gray-800">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-black text-gray-700 dark:text-gray-300">
                    📚 出品者（{selectedBook.seller_name || '学生'}さん）の他の商品（まとめ買い）
                  </p>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto border p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {books
                    .filter(b => b.seller_token === selectedBook.seller_token && (selectedBook.status_type === 'negotiating' ? b.status_type === 'negotiating' : b.status_type === 'active') && !b.is_hidden)
                    .map(b => {
                      const isChecked = b.id ? selectedBundleBookIds.includes(b.id) : false;
                      return (
                        <div key={b.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-gray-700 shadow-sm gap-2">
                          
                          {/* 1. 画像部分（タップで拡大専用・カゴに入らない） */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (b.image_url) {
                                setZoomImageUrl(b.image_url);
                              }
                            }}
                            className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center cursor-pointer border relative group"
                            title="タップして画像を拡大"
                          >
                            {b.image_url ? (
                              <>
                                <img src={b.image_url} alt={b.title} className="w-full h-full object-cover pointer-events-none" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition">
                                  拡大
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] text-gray-400">なし</span>
                            )}
                          </div>

                          {/* 2. 選択部分（チェックボックス ＆ タイトル・価格：タップでカゴに入る） */}
                          <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (!b.id) return;
                                if (e.target.checked) {
                                  setSelectedBundleBookIds([...selectedBundleBookIds, b.id]);
                                } else {
                                  setSelectedBundleBookIds(selectedBundleBookIds.filter(id => id !== b.id));
                                }
                              }}
                              className="w-5 h-5 text-blue-600 rounded flex-shrink-0"
                            />
                            <span className="truncate text-xs font-bold text-gray-900 dark:text-gray-100">{b.title}</span>
                          </label>

                          <span className="text-red-600 font-black text-xs flex-shrink-0">¥{(b.price || 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                </div>

                {/* 💰 まとめ買い合計金額表示 */}
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-2xl flex justify-between items-center border border-blue-200 dark:border-blue-800">
                  <span className="text-xs font-black text-blue-900 dark:text-blue-300">
                    選択中: <strong>{selectedBundleBookIds.length}</strong> 冊
                  </span>
                  <span className="text-base font-black text-red-600">
                    合計: ¥{bundleTotalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* 各種操作ボタン */}
            <div className="space-y-2 pt-2">
              {/* 交渉中・完了・キャンセルボタン */}
              {selectedBook.status_type === 'negotiating' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCompleteBundleSale}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-base py-3 rounded-2xl font-black shadow"
                  >
                    🎉 取引完了 ({selectedBundleBookIds.length}冊)
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelBundleNegotiation}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-base py-3 rounded-2xl font-black shadow"
                  >
                    ⚠️ 交渉キャンセル ({selectedBundleBookIds.length}冊)
                  </button>
                </div>
              )}

              {/* 購入・交渉開始ボタン */}
              {selectedBook.status_type === 'active' && !((selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken)) && (
                <button
                  type="button"
                  onClick={handleStartBundleNegotiation}
                  className="bg-green-600 hover:bg-green-700 text-white text-base py-3.5 rounded-2xl font-black w-full shadow-md"
                >
                  🛒 選択した {selectedBundleBookIds.length} 冊（¥{bundleTotalPrice.toLocaleString()}）を交渉・購入する
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* 通報ボタン */}
                <button
                  type="button"
                  onClick={() => handleReport(selectedBook)}
                  className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm py-3 rounded-2xl font-bold border"
                >
                  🚩 違反通報
                </button>

                {/* 削除ボタン */}
                {((selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken) || isAdminMode) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedBook)}
                    className="bg-red-50 text-red-600 border-red-200 text-sm py-3 rounded-2xl font-black border"
                  >
                    🗑️ 削除する
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function NotificationSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setEmail(localStorage.getItem('my_notification_email') || '');
  }, []);

  if (!isOpen) return null;

  const handleSaveAndTestEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      alert('有効なメールアドレスを入力してください。');
      return;
    }

    localStorage.setItem('my_notification_email', trimmed);
    setSendingTest(true);
    setStatusMsg('送信中...');

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: trimmed,
          subject: '【キャンパスフリマ】テストメールの送信成功',
          text: `学内教科書フリマをご利用いただきありがとうございます！\n\nメールアドレス（${trimmed}）の登録が正常に完了しました。\n今後は取引チャットで新しいメッセージが届いた際に通知メールが配信されます。`,
        }),
      });

      if (res.ok) {
        setStatusMsg('✅ 保存完了！テストメールを送信しました。受信箱をご確認ください。');
      } else {
        setStatusMsg('⚠️ 保存しましたが、テストメールの送信に失敗しました。アドレスをご確認ください。');
      }
    } catch (e) {
      setStatusMsg('⚠️ 通信エラーが発生しました。');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-3xl w-full p-6 relative shadow-2xl border-2 border-blue-500">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 font-black text-xl">✕</button>
        <h2 className="text-xl font-black mb-2">🔔 メール通知設定</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-3">
          取引相手からのメッセージ通知を受け取るメールアドレスを入力してください。
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@gmail.com"
          className="w-full border-2 rounded-2xl p-3.5 text-base font-bold mb-3 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
        />
        <button
          type="button"
          onClick={handleSaveAndTestEmail}
          disabled={sendingTest}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl text-base shadow disabled:bg-gray-400"
        >
          {sendingTest ? 'テストメール送信中...' : '保存してテストメールを送信'}
        </button>
        {statusMsg && <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mt-3 text-center">{statusMsg}</p>}
      </div>
    </div>
  );
}