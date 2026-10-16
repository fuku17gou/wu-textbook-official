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

  const handleNameChangeInQA = async () => {
    const confirmChange = confirm(
      '【ご注意】\n交渉・取引中にアカウント名を変更すると、取引相手（出品者・購入者）が混乱する原因となります。\n\n本当に名前を変更しますか？'
    );
    if (!confirmChange) return;

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

    const { data: existingChats } = await supabase
      .from('chats')
      .select('*')
      .or(`and(buyer_token.eq.${mySellerToken},seller_token.eq.${sellerToken}),and(buyer_token.eq.${sellerToken},seller_token.eq.${mySellerToken})`);

    if (existingChats && existingChats.length > 0) {
      setActiveChat(existingChats[0]);
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

    const targetBooks = books.filter(b => b.id && selectedBundleBookIds.includes(b.id));

    const agreeBuyTerms = confirm(
      `【まとめ買い購入の確認】\n\n以下の ${targetBooks.length} 冊の取引交渉を開始します。\n\n※「OK」を押すと利用規約に同意したとみなし、アプリ内チャットが開きます。取引交渉を進めますか？`
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

    await fetchBooks();
    setSelectedBook(null);
    handleOpenOrCreateChat(selectedBook.seller_token, selectedBook.title, selectedBook.seller_name);
  };

  const handleCompleteBundleSale = async () => {
    if (!selectedBook) return;
    const isMyBook = (selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken);

    if (!isMyBook && !isAdminMode) {
      alert('取引を完了できるのは出品者のみです。');
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

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6 text-gray-900 dark:text-gray-100" onPaste={handlePaste}>
      {/* ヘッダー部分（メール通知ボタンは重複のため削除） */}
      <div className="flex justify-between items-center flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold">学内教科書フリマ</h1>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">👤 アカウント名: {myNickname || '未設定'}</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(true);
              markNotificationsAsRead();
            }}
            className="relative text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 font-bold px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700"
          >
            🔔 通知
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
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
            className="relative text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 font-bold px-3 py-1.5 rounded border border-blue-300 dark:border-blue-800"
          >
            💬 メッセージ一覧 ({myChats.length})
            {totalUnreadChatsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">
                {totalUnreadChatsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowQA(true)}
            className="text-xs text-amber-800 dark:text-amber-300 hover:underline font-bold bg-amber-50 dark:bg-amber-950 px-2.5 py-1.5 rounded border border-amber-300 dark:border-amber-800"
          >
            ❓ Q&A・使い方
          </button>
          
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold bg-blue-50 dark:bg-blue-950 px-2.5 py-1.5 rounded border border-blue-200 dark:border-blue-800"
          >
            📄 利用規約
          </button>
          
          <button
            onClick={handleToggleAdmin}
            className={`text-xs px-3 py-1.5 rounded font-bold border transition ${
              isAdminMode ? 'bg-red-600 text-white border-red-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-200'
            }`}
          >
            {isAdminMode ? '🔧 管理者モード中 (解除)' : '⚙️ 管理者'}
          </button>
        </div>
      </div>

      {/* 🌟 コンパクト＆スッキリしたメール通知促進バナー */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0">
            便利機能
          </span>
          <p className="font-bold">✉️ 取引メッセージをメールで受け取る</p>
        </div>
        <button
          type="button"
          onClick={() => setShowEmailModal(true)}
          className="bg-white text-blue-700 hover:bg-blue-50 font-extrabold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1 whitespace-nowrap ml-auto"
        >
          通知を設定する ＞
        </button>
      </div>

      {/* 📊 管理者専用アナリティクス（アクセス実績 ＆ グラフ表示）バー */}
      {isAdminMode && (
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-xl border-2 border-red-500 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <h3 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              📊 【管理者限定】アクセス実績アナリティクス
            </h3>
            <button
              onClick={handleRefreshAnalytics}
              disabled={isRefreshingAnalytics}
              className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded border border-blue-400 font-bold transition flex items-center gap-1 disabled:bg-gray-600"
            >
              <span className={isRefreshingAnalytics ? 'animate-spin inline-block' : ''}>🔄</span>
              {isRefreshingAnalytics ? '更新中...' : '最新情報に更新'}
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold">今日の閲覧数</p>
              <p className="text-xl font-extrabold text-blue-400 mt-0.5">{analytics.today.toLocaleString()} <span className="text-xs font-normal text-slate-300">PV</span></p>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold">今月の閲覧数</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{analytics.thisMonth.toLocaleString()} <span className="text-xs font-normal text-slate-300">PV</span></p>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
              <p className="text-[10px] text-slate-400 font-bold">累計総閲覧数</p>
              <p className="text-xl font-extrabold text-amber-400 mt-0.5">{analytics.total.toLocaleString()} <span className="text-xs font-normal text-slate-300">PV</span></p>
            </div>
          </div>

          <div className="bg-slate-800/90 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">
                📈 トレンドグラフ ({chartViewMode === 'daily' ? '直近30日間' : '直近2年間 (24ヶ月)'})
              </span>
              <div className="flex bg-slate-900 rounded p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setChartViewMode('daily')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded transition ${
                    chartViewMode === 'daily' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  日別 (30日)
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('monthly')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded transition ${
                    chartViewMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  月別 (2年)
                </button>
              </div>
            </div>

            <div className="h-48 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartViewMode === 'daily' ? dailyChartData : monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="label" 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 9 }} 
                    interval={chartViewMode === 'daily' ? 2 : 0} 
                  />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value: any) => [`${value} PV`, '閲覧数']}
                  />
                  <Bar dataKey="pv" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-right">※企業提案時の実績グラフィックデータとしてご活用いただけます。</p>
        </div>
      )}

      {/* 初回ニックネーム登録モーダル */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl max-w-sm w-full space-y-4 text-gray-900 dark:text-gray-100 shadow-2xl border-2 border-blue-500">
            <h2 className="text-lg font-bold text-blue-900 dark:text-blue-400">👋 はじめまして！</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              学内フリマへようこそ！取引やチャットで表示されるあなたの<strong>アカウント名（ニックネーム）</strong>を入力してください。
            </p>
            <form onSubmit={handleSaveNickname} className="space-y-3">
              <input
                type="text"
                placeholder="例: 文学部 太郎"
                value={tempNicknameInput}
                onChange={(e) => setTempNicknameInput(e.target.value)}
                className="w-full border p-2.5 text-sm rounded font-medium outline-none focus:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
                maxLength={20}
                autoFocus
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded font-bold text-sm shadow transition"
              >
                決定してはじめる
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 出品フォーム */}
      <form onSubmit={handleAddBook} className="border p-4 rounded-lg space-y-4 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold">教科書を出品する</h2>

        <div>
          <label className="block text-sm font-medium mb-1">教科書名（3文字以上）</label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例: ミクロ経済学"
            className="w-full border p-2 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">価格 (円 ※100〜1万円)</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="1000"
              min="100"
              max="10000"
              className="w-full border p-2 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700"
            />
          </div>
          <div className="mt-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 rounded-lg text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-bold flex items-center gap-1">
              💡 スムーズな取引のためのお願い
            </p>
            <p className="leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
              対面での現金の受け渡しをスムーズにするため、価格は<strong>100円単位</strong>での設定をお願いします。
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">状態</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full border p-2 rounded bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700"
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
          <label className="block text-sm font-medium mb-1">教科書の画像（自動圧縮・5MB以下・任意）</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-4 rounded-lg text-center transition ${
              isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center gap-2">
                <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded border border-gray-300 dark:border-gray-600" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-500 underline"
                >
                  画像をやり直す
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">ここに画像をドラッグ＆ドロップ、または <strong>Ctrl + V</strong> で貼り付け</p>
                <div className="flex justify-center">
                  <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="text-sm text-gray-500 dark:text-gray-400" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-700">
          <input
            type="checkbox"
            id="agreeTerms"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <label htmlFor="agreeTerms" className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
            <button type="button" onClick={() => setShowTerms(true)} className="text-blue-600 dark:text-blue-400 underline font-bold mx-0.5">
              利用規約・プライバシーポリシー
            </button>
            の内容に同意して出品します
          </label>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {uploading ? '出品処理中...' : '出品する'}
        </button>
      </form>

      {/* 一覧＆検索エリア */}
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-lg font-bold">教科書を探す</h2>
          
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-bold">並び替え:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border p-1.5 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 font-medium"
            >
              <option value="newest">新着順</option>
              <option value="price-asc">価格が安い順</option>
              <option value="price-desc">価格が高い順</option>
            </select>
          </div>
        </div>

        {/* タブ切り替えボタン */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActiveTab('all'); setIsBulkDeleteMode(false); }}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'all' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            📚 すべて
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('active'); setIsBulkDeleteMode(false); }}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'active' ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            📖 出品中 ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('negotiating'); setIsBulkDeleteMode(false); }}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'negotiating' ? 'border-amber-600 text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            🤝 交渉中 ({negotiatingCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('sold'); setIsBulkDeleteMode(false); }}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'sold' ? 'border-red-600 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            🏷️ 売り切れ ({soldCount})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('liked'); setIsBulkDeleteMode(false); }}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'liked' ? 'border-pink-600 text-pink-600 dark:text-pink-400 bg-pink-50/50 dark:bg-pink-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            ❤️ お気に入り ({likedBookIds.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mine')}
            className={`flex-1 py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap ${
              activeTab === 'mine' ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
            }`}
          >
            👤 自分の出品 ({myCount})
          </button>
        </div>

        {/* 一括削除バー */}
        {activeTab === 'mine' && myCount > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-lg flex justify-between items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setIsBulkDeleteMode(!isBulkDeleteMode);
                setBulkDeleteBookIds([]);
              }}
              className={`text-xs font-bold px-3 py-1.5 rounded transition border ${
                isBulkDeleteMode ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100'
              }`}
            >
              {isBulkDeleteMode ? '✕ 一括削除モードを終了' : '☑️ まとめて削除する（一括削除）'}
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
                  className="text-xs bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded border border-blue-300 dark:border-blue-700 font-bold hover:bg-blue-50"
                >
                  {bulkDeleteBookIds.length === books.filter(b => (b.id && myBookIds.includes(b.id)) || (b.seller_token === mySellerToken)).length ? '全解除' : 'すべて選択'}
                </button>

                <button
                  type="button"
                  disabled={bulkDeleteBookIds.length === 0}
                  onClick={handleBulkDelete}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded font-bold disabled:bg-gray-300 shadow-sm transition"
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
          className="w-full border p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700"
        />

        {loading ? (
          <p className="text-center text-gray-500 py-4">読み込み中...</p>
        ) : filteredBooks.length === 0 ? (
          <p className="text-gray-500 text-center py-4">該当する教科書がありません</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredBooks.map((book, index) => {
              const isMyBook = (book.id && myBookIds.includes(book.id)) || (book.seller_token === mySellerToken);
              const statusType = book.status_type || 'active';
              const isLiked = book.id ? likedBookIds.includes(book.id) : false;
              const isBulkChecked = book.id ? bulkDeleteBookIds.includes(book.id) : false;

              const showAd = (index + 1) % 4 === 0;

              return (
                <div key={book.id || book.title} className="space-y-4">
                  <div
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
                    className={`border p-4 rounded-lg flex gap-4 items-center cursor-pointer hover:shadow-md transition border-gray-200 dark:border-gray-800 ${
                      statusType === 'sold' ? 'bg-gray-100 dark:bg-gray-800/50 opacity-70' : 'bg-white dark:bg-gray-800'
                    } ${isBulkDeleteMode && isMyBook && isBulkChecked ? 'border-red-500 bg-red-50/30 dark:bg-red-950/30' : ''}`}
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
                        className="w-5 h-5 text-red-600 rounded flex-shrink-0 cursor-pointer"
                      />
                    )}

                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {book.image_url ? (
                        <img src={book.image_url} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">画像なし</span>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{book.title}</h3>
                        {statusType === 'sold' && (
                          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded font-bold">
                            SOLD OUT
                          </span>
                        )}
                        {statusType === 'negotiating' && (
                          <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded font-bold animate-pulse">
                            交渉中
                          </span>
                        )}
                        {isMyBook && (
                          <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded font-bold border border-blue-300 dark:border-blue-800">
                            自分の出品
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">状態: {book.status}</p>
                      {book.seller_name && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">出品者: {book.seller_name}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(book, e)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition font-bold ${
                            isLiked ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-800' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {isLiked ? '❤️ お気に入り済' : '🤍 お気に入り'}
                          <span className="ml-0.5 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded text-gray-900 dark:text-gray-100">
                            {book.like_count || 0}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">¥{(book.price || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{isBulkDeleteMode && isMyBook ? '選択' : '詳細を見る ＞'}</p>
                    </div>
                  </div>

                  {showAd && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-indigo-950 border border-blue-200 dark:border-slate-700 p-4 rounded-lg flex items-center justify-between shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                            フリマ公式案内
                          </span>
                          <span className="text-xs font-bold text-blue-900 dark:text-blue-200">学内教科書フリマへようこそ！</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          使わなくなった教科書を出品して、次の世代の学生に繋げよう！完全無料で気軽に使えます。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="text-center pt-8 pb-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
        <p>© 2026 学内教科書フリマ運営</p>
      </footer>

      {/* 画面真ん中の案内ポップアップ */}
      {showPopupAd && activePopupAd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full overflow-hidden shadow-2xl relative text-gray-900 dark:text-gray-100 border-4 border-blue-400">
            <button
              onClick={() => setShowPopupAd(false)}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition z-10"
            >
              ✕
            </button>

            <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 relative overflow-hidden">
              <img src={activePopupAd.image} alt={activePopupAd.company} className="w-full h-full object-cover" />
              <span className="absolute bottom-2 left-2 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded shadow">
                📢 {activePopupAd.tag}
              </span>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">{activePopupAd.company}</p>
                <h3 className="text-lg font-bold mt-1">{activePopupAd.catchcopy}</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                {activePopupAd.description}
              </p>

              <button
                type="button"
                onClick={() => setShowPopupAd(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-sm shadow transition"
              >
                さっそくフリマを使う
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 画像全画面拡大（ライトボックス）モーダル */}
      {zoomImageUrl && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[100] cursor-zoom-out"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img src={zoomImageUrl} alt="拡大画像" className="max-w-full max-h-full object-contain rounded shadow-2xl" />
            <p className="absolute top-2 right-2 text-white bg-black/60 px-3 py-1 rounded-full text-xs font-bold">
              ✕ タップして閉じる
            </p>
          </div>
        </div>
      )}

      {/* 商品詳細モーダル */}
      {selectedBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 relative shadow-xl border border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white font-bold text-xl"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold">{selectedBook.title}</h2>

            <div 
              onClick={() => selectedBook.image_url && setZoomImageUrl(selectedBook.image_url)}
              className={`w-full h-64 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-700 relative group ${selectedBook.image_url ? 'cursor-zoom-in' : ''}`}
            >
              {selectedBook.image_url ? (
                <>
                  <img src={selectedBook.image_url} alt={selectedBook.title} className="w-full h-full object-contain transition group-hover:scale-105" />
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 font-bold">
                    🔍 タップで拡大
                  </span>
                </>
              ) : (
                <span className="text-gray-400">画像なし</span>
              )}
            </div>

            <div className="space-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ¥{(selectedBook.price || 0).toLocaleString()}
                </span>
                <span className="text-sm bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-1 rounded font-medium border border-gray-200 dark:border-gray-700">
                  状態: {selectedBook.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                お気に入り登録数: <span className="font-bold text-pink-600 dark:text-pink-400">{selectedBook.like_count || 0}人</span>
              </p>
            </div>

            {/* 💬 チャットエリア */}
            {selectedBook.status_type === 'negotiating' ? (
              <div className="space-y-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3 rounded">
                {(((selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken)) || (selectedBook.negotiator_token === mySellerToken) || isAdminMode) ? (
                  <>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300">💬 交渉中（専用チャットルーム）</p>
                    <button
                      type="button"
                      onClick={async () => {
                        const isMine = (selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken);
                        const targetOtherToken = isMine ? (selectedBook.negotiator_token || '') : (selectedBook.seller_token || '');
                        const targetOtherName = isMine ? (selectedBook.negotiator_name || '交渉相手') : (selectedBook.seller_name || '出品者');
                        setSelectedBook(null);
                        await handleOpenOrCreateChat(targetOtherToken, selectedBook.title, targetOtherName);
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-3 rounded text-xs transition shadow-sm"
                    >
                      💬 取引チャットを開く
                    </button>
                  </>
                ) : (
                  <div className="text-center py-2 space-y-1">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">🔒 現在、他のユーザーがこの商品の交渉中です</p>
                  </div>
                )}
              </div>
            ) : null}

            {selectedBook.seller_token && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {selectedBook.status_type === 'negotiating' ? '⚠️ 取引完了またはキャンセルする商品を選択' : '👤 まとめ買い（この出品者の他の商品も選択可能）'}
                  </h3>
                </div>
                
                <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800/60 p-2 rounded border border-gray-200 dark:border-gray-700">
                  {books
                    .filter((b) => b.seller_token === selectedBook.seller_token && (selectedBook.status_type === 'negotiating' ? b.status_type === 'negotiating' : b.status_type === 'active'))
                    .map((targetBook) => {
                      const isChecked = targetBook.id ? selectedBundleBookIds.includes(targetBook.id) : false;
                      const isCurrent = targetBook.id === selectedBook.id;
                      return (
                        <label
                          key={targetBook.id}
                          className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition ${
                            isChecked ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate pr-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isCurrent}
                              onChange={(e) => {
                                if (!targetBook.id || isCurrent) return;
                                if (e.target.checked) {
                                  setSelectedBundleBookIds([...selectedBundleBookIds, targetBook.id]);
                                } else {
                                  setSelectedBundleBookIds(selectedBundleBookIds.filter(id => id !== targetBook.id));
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded flex-shrink-0"
                            />
                            <div 
                              onClick={(e) => {
                                if (targetBook.image_url) {
                                  e.stopPropagation();
                                  setZoomImageUrl(targetBook.image_url);
                                }
                              }}
                              className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 overflow-hidden flex items-center justify-center cursor-zoom-in"
                            >
                              {targetBook.image_url ? (
                                <img src={targetBook.image_url} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[9px] text-gray-400">なし</span>
                              )}
                            </div>
                            <span className="truncate font-medium">
                              {targetBook.title} {isCurrent && '(表示中の商品)'}
                            </span>
                          </div>
                          <span className="text-red-600 dark:text-red-400 font-bold flex-shrink-0">¥{targetBook.price.toLocaleString()}</span>
                        </label>
                      );
                    })}
                </div>

                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 rounded text-sm font-bold">
                  <span className="text-blue-900 dark:text-blue-200">選択した {selectedBundleBookIds.length} 冊の合計金額:</span>
                  <span className="text-red-600 dark:text-red-400 text-lg">
                    ¥{books
                      .filter(b => b.id && selectedBundleBookIds.includes(b.id))
                      .reduce((sum, b) => sum + b.price, 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* アクションボタン群 */}
            <div className="flex flex-wrap gap-2 pt-2 justify-end">
              <button
                type="button"
                onClick={() => handleToggleLike(selectedBook)}
                className={`text-xs px-3 py-2 rounded font-bold border transition flex items-center gap-1 ${
                  selectedBook.id && likedBookIds.includes(selectedBook.id)
                    ? 'bg-pink-50 dark:bg-pink-950 text-pink-600 dark:text-pink-400 border-pink-300 dark:border-pink-800' 
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-pink-50'
                }`}
              >
                {selectedBook.id && likedBookIds.includes(selectedBook.id) ? '❤️ お気に入り済み' : '🤍 お気に入りに追加'}
              </button>

              {(() => {
                const isMyBook = (selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken);
                const isMyNegotiation = selectedBook.negotiator_token === mySellerToken;
                const statusType = selectedBook.status_type || 'active';

                if (isMyBook) {
                  if (statusType === 'negotiating') {
                    return (
                      <>
                        <button
                          onClick={handleCompleteBundleSale}
                          className="bg-green-600 text-white text-xs px-3 py-2 rounded font-bold hover:bg-green-700"
                        >
                          取引完了 ({selectedBundleBookIds.length}冊)
                        </button>
                        <button
                          onClick={handleCancelBundleNegotiation}
                          className="bg-amber-600 text-white text-xs px-3 py-2 rounded font-bold hover:bg-amber-700"
                        >
                          キャンセル ({selectedBundleBookIds.length}冊)
                        </button>
                      </>
                    );
                  }
                  return <span className="text-xs text-gray-400 dark:text-gray-500 font-bold px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">自分の出品</span>;
                } else if (isMyNegotiation) {
                  if (statusType === 'negotiating') {
                    return (
                      <button
                        onClick={handleCancelBundleNegotiation}
                        className="bg-amber-600 text-white text-xs px-3 py-2 rounded font-bold hover:bg-amber-700 shadow-sm"
                      >
                        ⏳ 交渉をキャンセル (10分以内)
                      </button>
                    );
                  }
                } else {
                  if (statusType === 'active') {
                    return (
                      <button
                        onClick={handleStartBundleNegotiation}
                        className="bg-green-600 text-white text-xs px-4 py-2 rounded font-bold hover:bg-green-700 shadow-sm"
                      >
                        🛒 まとめ買い交渉を始める ({selectedBundleBookIds.length}冊)
                      </button>
                    );
                  }
                  return null;
                }
              })()}

              {selectedBook.id && !((selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken)) && (
                <button
                  type="button"
                  onClick={() => handleReport(selectedBook)}
                  className={`text-xs px-3 py-2 rounded font-bold border transition ${
                    reportedBookIds.includes(selectedBook.id) || reportedBookIds.includes(selectedBook.title)
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 cursor-not-allowed' 
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-orange-50 hover:text-orange-600'
                  }`}
                >
                  {reportedBookIds.includes(selectedBook.id) || reportedBookIds.includes(selectedBook.title) ? '通報済み' : '⚠️ 通報'}
                </button>
              )}

              {(((selectedBook.id && myBookIds.includes(selectedBook.id)) || (selectedBook.seller_token === mySellerToken)) || isAdminMode) && (
                <button
                  onClick={() => handleDelete(selectedBook)}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs px-3 py-2 rounded hover:bg-red-100 hover:text-red-600 font-bold transition"
                >
                  削除
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedBook(null)}
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-2 rounded font-bold hover:bg-gray-200 dark:hover:bg-gray-700 text-sm mt-4 border border-gray-200 dark:border-gray-700"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 💬 チャット画面 */}
      {activeChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-lg w-full h-[85vh] flex flex-col relative text-gray-900 dark:text-gray-100 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800 rounded-t-lg">
              <div>
                <h3 className="font-bold text-sm">💬 取引チャット</h3>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 font-bold mt-0.5">
                  相手: {activeChat.buyer_token === mySellerToken 
                    ? `${(activeChat.seller_name && activeChat.seller_name !== '出品者') ? activeChat.seller_name : (books.find(b => b.seller_token === activeChat.seller_token)?.seller_name || '出品者')}【出品者】` 
                    : `${activeChat.buyer_name || '購入希望者'}【購入希望者】`}
                </p>
              </div>
              <button onClick={() => setActiveChat(null)} className="text-gray-400 hover:text-black dark:hover:text-white font-bold">✕</button>
            </div>

            {activeChat.seller_token === mySellerToken && (
              <div className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-800 px-3 py-2 text-[11px] text-emerald-900 dark:text-emerald-200 font-bold flex items-center gap-1.5">
                <span>💡</span>
                <span>対面での受け渡しが終わったら、商品の詳細画面から<strong>「取引完了」</strong>ボタンを押してください。</span>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 p-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-amber-900 dark:text-amber-200 font-bold">💡 テンプレート:</span>
              <button
                type="button"
                onClick={() => {
                  const targetBooks = books.filter(b => (b.seller_token === activeChat.seller_token || b.negotiator_token === mySellerToken) && b.status_type === 'negotiating');
                  const titles = targetBooks.map(b => `・${b.title} (¥${b.price.toLocaleString()})`).join('\n');
                  const total = targetBooks.reduce((sum, b) => sum + b.price, 0);
                  const template = `学内教科書フリマを見て連絡しました！以下の ${targetBooks.length} 冊をまとめて購入・交渉希望です。\n\n${titles}\n\n【合計金額】 ¥${total.toLocaleString()}\n\n学内の受け渡し場所とご都合の良い日時についてご相談させてください。よろしくお願いいたします！`;
                  setNewMessageText(template);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm transition"
              >
                📋 購入・交渉用テンプレートをセット
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-100 dark:bg-gray-950">
              {messages.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8">まだメッセージはありません。テンプレートを使って挨拶や受取日時を相談してみましょう！</p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_token === mySellerToken;
                  const displayName = isMe ? (myNickname || '自分') : (msg.sender_name || 'お相手');
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 px-1 font-semibold">{displayName}</span>
                      <div className={`max-w-[75%] p-3 rounded-xl text-xs ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-none shadow-sm'}`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <span className={`text-[9px] block mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2 rounded-b-lg">
              <input
                type="text"
                placeholder="メッセージを入力..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                className="flex-1 border border-gray-300 dark:border-gray-700 p-2 text-xs rounded outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-xs font-bold transition">
                送信
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 💬 チャット一覧モーダル */}
      {showChatList && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto text-gray-900 dark:text-gray-100 relative border border-gray-200 dark:border-gray-800">
            <button onClick={() => setShowChatList(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white font-bold">✕</button>
            <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
              <h2 className="text-lg font-bold">💬 メッセージ一覧</h2>
            </div>

            {myChats.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-6">現在やり取り中のチャットはありません。</p>
            ) : (
              <div className="space-y-2">
                {myChats.map((chat) => {
                  const isBuyer = chat.buyer_token === mySellerToken;

                  let rawName = isBuyer ? chat.seller_name : chat.buyer_name;
                  if (isBuyer) {
                    const matchedBook = books.find(b => b.seller_token === chat.seller_token);
                    if (matchedBook && matchedBook.seller_name) {
                      rawName = matchedBook.seller_name;
                    }
                  }
                  const roleLabel = isBuyer ? '【出品者】' : '【購入希望者】';
                  const partnerDisplay = `${rawName && rawName !== '出品者' ? rawName : (isBuyer ? '出品者' : '購入希望者')} ${roleLabel}`;

                  const targetPartnerToken = isBuyer ? chat.seller_token : chat.buyer_token;
                  const relatedBooks = books.filter(b => 
                    (b.seller_token === chat.seller_token && b.negotiator_token === chat.buyer_token) ||
                    (b.seller_token === targetPartnerToken)
                  );
                  const relatedBookTitle = relatedBooks.length > 0 ? relatedBooks[0].title : 'お取引商品';
                  const isUnread = unreadChatMap[chat.id];

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        setShowChatList(false);
                        setActiveChat(chat);
                      }}
                      className={`p-3 border rounded-lg hover:bg-blue-50 dark:hover:bg-gray-800 cursor-pointer transition flex justify-between items-center gap-2 relative ${
                        isUnread ? 'bg-red-50/60 dark:bg-red-950/40 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex-1 truncate space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full inline-block ${isUnread ? 'bg-red-600 animate-pulse' : 'bg-blue-600'}`}></span>
                          <span className="font-bold text-sm truncate">
                            {partnerDisplay}
                          </span>
                          {isUnread && (
                            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded font-bold">
                              新着
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-800 dark:text-blue-300 font-medium truncate">
                          📖 対象: 「{relatedBookTitle}」{relatedBooks.length > 1 ? ` ほか${relatedBooks.length - 1}冊` : ''}
                        </p>
                        <p className="text-[10px] text-gray-400">開始日: {new Date(chat.created_at).toLocaleString()}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded font-bold shadow-sm">開く</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChat(chat.id, e)}
                          className="bg-red-50 dark:bg-red-950 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded font-bold border border-red-200 dark:border-red-800 transition"
                        >
                          ✕ 削除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🔔 通知一覧モーダル */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto text-gray-900 dark:text-gray-100 relative border border-gray-200 dark:border-gray-800">
            <button onClick={() => setShowNotifications(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white font-bold">✕</button>
            <h2 className="text-lg font-bold border-b border-gray-200 dark:border-gray-800 pb-2">🔔 お知らせ・通知</h2>

            {notifications.length === 0 ? (
              <p className="text-center text-xs text-gray-500 py-6">通知はありません。</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => {
                  const isChatNotice = n.title.includes('メッセージ') || n.title.includes('お問い合わせ');
                  return (
                    <div key={n.id} className={`p-3 border rounded-lg text-xs space-y-2 ${!n.is_read ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'}`}>
                      <div>
                        <p className="font-bold">{n.title}</p>
                        <p className="text-gray-600 dark:text-gray-300 mt-0.5">{n.body}</p>
                        <span className="text-[9px] text-gray-400 block mt-1">{new Date(n.created_at).toLocaleString()}</span>
                      </div>

                      {isChatNotice && (
                        <button
                          type="button"
                          onClick={async () => {
                            setShowNotifications(false);
                            await fetchMyChats();
                            if (myChats.length > 0) {
                              setActiveChat(myChats[0]);
                            } else {
                              setShowChatList(true);
                            }
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded font-bold text-xs shadow-sm transition flex items-center justify-center gap-1"
                        >
                          💬 このチャットを開く ＞
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✉️ メール通知設定モーダル */}
      <NotificationSettingsModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />

      {/* ❓ Q&A・使い方 ＆ アカウント設定 モーダル */}
      {showQA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-lg w-full space-y-5 max-h-[85vh] overflow-y-auto text-gray-900 dark:text-gray-100 relative border border-gray-200 dark:border-gray-800">
            <button onClick={() => setShowQA(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black dark:hover:text-white font-bold text-xl">✕</button>
            <h2 className="text-xl font-bold border-b border-gray-200 dark:border-gray-800 pb-2">❓ よくある質問（Q&A・ガイド）</h2>
            
            <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 p-3.5 rounded-lg space-y-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-blue-900 dark:text-blue-200 text-sm">👤 アカウント設定</p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">現在の名前: <strong>{myNickname || '未設定'}</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={handleNameChangeInQA}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow-sm transition"
                  >
                    ✏️ 名前を変更する
                  </button>
                </div>
                <div className="bg-amber-100/70 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 p-2 rounded text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                  <p className="font-bold flex items-center gap-1">⚠️ 名前変更に関する注意事項</p>
                  <p>交渉中や取引中のアカウント名変更は、相手の出品者・購入者が誰とやり取りしているか困惑する原因となりますのでお控えください。</p>
                </div>
              </div>

              <div className="bg-pink-50 dark:bg-pink-950/60 border border-pink-200 dark:border-pink-800 p-3.5 rounded-lg space-y-2">
                <p className="font-bold text-pink-900 dark:text-pink-200 text-sm">🐛 バグ・トラブルの報告・お問い合わせ</p>
                <p className="text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  不具合やトラブルが発生した場合は、公式Instagram（<strong>@wu_textbook_official</strong>）のダイレクトメッセージ（DM）までご連絡ください。
                </p>
                <a
                  href="https://instagram.com/wu_textbook_official"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition mt-1"
                >
                  📸 InstagramのDMで報告・相談する ↗
                </a>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Q. 取引通知メールを届かせるには？</p>
                <p className="text-gray-600 dark:text-gray-300">A. 画面上の青い案内バナー「通知を設定する」から、通知を受け取りたいメールアドレス（大学用・私用どちらでも可）を設定してください。</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Q. 利用料金・手数料はかかりますか？</p>
                <p className="text-gray-600 dark:text-gray-300">A. 出品・購入ともに完全無料です。学内での対面手渡しを行うため送料も一切かかりません。</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Q. 支払いや現金の受け渡し方法は？</p>
                <p className="text-gray-600 dark:text-gray-300">A. キャンパス内で商品を受け取る際に、対面で直接現金をやり取りしてください。お互いにお釣りの出ないよう、事前にピッタリの金額を用意することをお勧めします。</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Q. 出品した商品を削除するには？</p>
                <p className="text-gray-600 dark:text-gray-300">A. 自分の出品タブまたは詳細画面から、簡単に削除することができます。</p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Q. 取引が完了したらどうすればいいですか？</p>
                <p className="text-gray-600 dark:text-gray-300">A. 出品者または購入者同士で対面受け渡しを完了させた後、商品の詳細画面またはチャットから「取引完了」ボタンを押してください。1週間後に自動で一覧から非表示になります。</p>
              </div>
            </div>

            <button onClick={() => setShowQA(false)} className="w-full bg-blue-600 text-white py-2.5 rounded font-bold hover:bg-blue-700 text-sm">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 利用規約・プライバシーポリシー モーダル */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full space-y-4 max-h-[80vh] overflow-y-auto text-gray-900 dark:text-gray-100 relative border border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold border-b border-gray-200 dark:border-gray-800 pb-2">📄 利用規約・プライバシーポリシー</h2>
            
            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
              <div>
                <p className="font-bold text-gray-800 dark:text-gray-200">1. 本サービスの目的</p>
                <p>当サービスは、同じキャンパスに通う学生間での不要となった教科書の譲渡・売買の機会を提供する学内掲示板サービスです。</p>
              </div>

              <div>
                <p className="font-bold text-gray-800 dark:text-gray-200">2. 利用条件と自己責任</p>
                <p>ユーザーは本規約に同意した上でサービスを利用するものとします。学内での対面取引における物品・現金のやり取りやトラブルについて、運営は一切の責任を負いません。当事者間で誠意を持ってご対応ください。</p>
              </div>

              <div>
                <p className="font-bold text-gray-800 dark:text-gray-200">3. 禁止事項</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>教科書・参考書以外の違法物や不適切な物品の出品</li>
                  <li>誹謗中傷、暴言、個人情報の無断掲載</li>
                  <li>虚偽の出品や意図的な取引妨害</li>
                  <li>他者になりすます行為</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 p-2.5 rounded">
                <p className="font-bold text-blue-900 dark:text-blue-200 mb-1">4. 個人情報の取り扱い（プライバシーポリシー）</p>
                <p className="text-blue-800 dark:text-blue-300 leading-relaxed">
                  当サービスでは、取引通知（新しいメッセージや購入希望連絡）の送信目的でのみユーザーのメールアドレスおよび設定ニックネームを取得・保存いたします。<br />
                  取得した個人情報は通知送信以外の目的で使用することや、第三者へ提供・公開することは一切ありません。また、安全に管理・保管されます。
                </p>
              </div>
            </div>

            <button onClick={() => setShowTerms(false)} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 text-sm">
              閉じる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// メール通知設定モーダル コンポーネント
// ==========================================
function NotificationSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('my_notification_email') || '';
    setEmail(savedEmail);
  }, []);

  const handleSaveAndTest = async () => {
    if (!email || !email.includes('@')) {
      setStatusMsg('正しいメールアドレスを入力してください');
      return;
    }

    setLoading(true);
    setStatusMsg('テストメールを送信中...');

    try {
      localStorage.setItem('my_notification_email', email);

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: '【キャンパスフリマ】通知テストメール',
          type: 'test',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatusMsg('✅ 保存完了！テストメールを送信しました。受信箱をご確認ください。');
      } else {
        setStatusMsg(`⚠️ 保存されましたが、メール送信エラー: ${data.error}`);
      }
    } catch (err) {
      setStatusMsg('⚠️ 通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-xl relative text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold">✕</button>
        
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          🔔 メール通知設定
        </h2>
        
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
          教科書が買われた際や、新しいメッセージが届いたときにメールでお知らせします。（大学用・私用どちらでもOKです）
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300 mb-4">
          🔒 <strong>プライバシー保護:</strong> 入力されたメールアドレスは通知送信のみに使用し、外部へ公開・共有されることは一切ありません。
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">通知用メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com または s123456@university.ac.jp"
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {statusMsg && (
          <div className="text-xs mb-4 p-2.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
            {statusMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSaveAndTest}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? '送信中...' : '保存してテスト送信'}
          </button>
        </div>
      </div>
    </div>
  );
}