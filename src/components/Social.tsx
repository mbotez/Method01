import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Users, Heart, Share2, MoreVertical, X, Search, Plus, Send, SlidersHorizontal, Camera } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../lib/supabase';

interface SocialProps {
  isFollowsOpen?: boolean;
  setIsFollowsOpen?: (open: boolean) => void;
  socialTab?: 'Messages' | 'Friends';
  setSocialTab?: (tab: 'Messages' | 'Friends') => void;
}

export const Social = ({
  isFollowsOpen: externalIsFollowsOpen,
  setIsFollowsOpen: externalSetIsFollowsOpen,
  socialTab: externalSocialTab,
  setSocialTab: externalSetSocialTab,
}: SocialProps) => {
  const [internalSocialTab, internalSetSocialTab] = useState<'Messages' | 'Friends'>('Friends');
  const [internalIsFollowsOpen, internalSetIsFollowsOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const socialTab = externalSocialTab !== undefined ? externalSocialTab : internalSocialTab;
  const setSocialTab = externalSetSocialTab !== undefined ? externalSetSocialTab : internalSetSocialTab;

  const isFollowsOpen = externalIsFollowsOpen !== undefined ? externalIsFollowsOpen : internalIsFollowsOpen;
  const setIsFollowsOpen = externalSetIsFollowsOpen !== undefined ? externalSetIsFollowsOpen : internalSetIsFollowsOpen;

  const [posts, setPosts] = useState<any[]>([]);
  const [follows, setFollows] = useState<any[]>([]);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'All' | 'Following' | 'Saved'>('All');
  
  // New: User Search
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const MessagesTab = () => {
      const [chats, setChats] = useState<{ [key: string]: { partnerName: string, messages: any[] } }>({});
      const [expandedChat, setExpandedChat] = useState<string | null>(null);

      useEffect(() => {
          const fetchMessages = async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              const { data, error } = await supabase
                  .from('messages')
                  .select('*, sender:users!messages_sender_id_fkey(username), receiver:users!messages_receiver_id_fkey(username)')
                  .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                  .order('timestamp', { ascending: true });

              if (error) {
                  console.error('Error fetching messages:', error);
                  return;
              }

              const grouped: { [key: string]: { partnerName: string, messages: any[] } } = {};
              data.forEach(m => {
                  const chatId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
                  const chatPartner = m.sender_id === user.id ? m.receiver?.username : m.sender?.username;
                  if (!grouped[chatId]) grouped[chatId] = { partnerName: chatPartner || 'Unknown', messages: [] };
                  grouped[chatId].messages.push(m);
              });
              setChats(grouped);
          };
          fetchMessages();
      }, []);

      return (
          <div className="space-y-4 flex-1 overflow-y-auto">
              {Object.entries(chats).map(([chatId, chatData]: [string, { partnerName: string, messages: any[] }]) => (
                  <div key={chatId} className="bg-black/5 rounded-xl overflow-hidden">
                      <button 
                        onClick={() => setExpandedChat(expandedChat === chatId ? null : chatId)}
                        className="w-full text-left p-3 font-black uppercase text-xs hover:bg-black/10 transition-colors"
                      >
                          {chatData.partnerName}
                      </button>
                      {expandedChat === chatId && (
                          <div className="p-3 bg-white border-t border-black/5 space-y-2">
                              {chatData.messages.map((m: any) => (
                                  <div key={m.id} className={`text-[10px] p-2 rounded-lg ${m.sender_id === chatData.messages[0].sender_id ? 'bg-venus-accent/10' : 'bg-black/5'}`}>
                                      <p className="font-black uppercase">{m.sender_id === chatData.messages[0].sender_id ? 'You' : chatData.partnerName}:</p>
                                      <p>{m.message}</p>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      );
  };


  // Follow user
  async function handleFollow(following_id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: following_id,
      });

    if (error) {
      console.error('Error following user:', error);
      return;
    }

    // Refresh data
    fetchInitialData();
    setUserSearch('');
    setUserSearchResults([]);
  }

  // New Comment State
  const [commentsOpenPostId, setCommentsOpenPostId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isArticle, setIsArticle] = useState(false);

  // New Post State
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleComment(post_id: string) {
    if (!newCommentText.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: post_id,
          user_id: user.id,
          content: newCommentText,
        });

      if (!error) {
        setNewCommentText('');
        setCommentsOpenPostId(null);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  }


  useEffect(() => {
    fetchInitialData();
  }, [filter]);

  // New: Search Users
  useEffect(() => {
    const searchUsers = async () => {
      if (userSearch.length > 0) {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, skin_type')
          .ilike('username', `%${userSearch}%`)
          .limit(5);
        if (error) {
          console.error('User search error:', error);
        } else {
          setUserSearchResults(data || []);
        }
      } else {
        setUserSearchResults([]);
      }
    };
    searchUsers();
  }, [userSearch]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Fetch Posts
      const { data: postsData, error: pError } = await supabase
        .from('posts')
        .select(`
          *,
          users (
            username,
            skin_type
          )
        `)
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (pError) console.error('Posts fetch error:', pError);
      setPosts(postsData || []);

      // Fetch Comments only for the loaded posts
      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(p => p.post_id);
        const { data: commentsData, error: cError } = await supabase
          .from('comments')
          .select(`
            *,
            users(username)
          `)
          .in('post_id', postIds);
        
        if (cError) console.error('Comments fetch error:', cError);
        if (commentsData) {
          const commentsByPost: {[key: string]: any[]} = {};
          commentsData.forEach(c => {
            if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
            commentsByPost[c.post_id].push(c);
          });
          setComments(commentsByPost);
        }
      } else {
        setComments({});
      }

      // Fetch Follows
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: followsData, error: fError } = await supabase
          .from('follows')
          .select(`
            id,
            following_id,
            following:users!following_id(username, skin_type)
          `)
          .eq('follower_id', user.id);
        
        if (fError) console.error('Follows error:', fError);
        setFollows(followsData || []);
      }
    } catch (err) {
      console.error('Error fetching social data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost() {
    if (!postContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let postMediaUrl = null;
      if (postImage) {
        const fileExt = postImage.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const compressedFile = await imageCompression(postImage, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1024,
          useWebWorker: false,
          fileType: 'image/webp'
        });

        const { error: uploadError } = await supabase.storage
          .from('Post_pics')
          .upload(fileName, compressedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('Post_pics')
          .getPublicUrl(fileName);
        
        postMediaUrl = publicUrl;
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          title: postTitle.trim() || null,
          content: postContent,
          post_media: postMediaUrl,
        });

      if (!error) {
        setPostTitle('');
        setPostContent('');
        setPostImage(null);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Error creating post:', err);
    }
  }

  const baseFiltered = posts.filter(p => 
    p.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayPosts = filter === 'Following' 
    ? baseFiltered.filter(p => follows.some(f => f.following_id === p.user_id))
    : baseFiltered;

  return (
    <div className="flex h-full w-full">
      {/* Panel 1: Topics (New Left Panel) - 3/10 width on desktop */}
      <div className={`hidden md:block w-[30%] border-r-2 border-black/5 pr-8 h-full overflow-y-auto`}>
        <div className="flex items-center justify-between mb-8 mt-2">
          <h2 className="text-xl font-black uppercase italic tracking-tighter">Topics</h2>
        </div>

        <div className="space-y-4">
          {['Skincare', 'Sunscreen', 'Anti-Aging', 'Acne', 'Sensitive'].map(topic => (
            <div key={topic} className="p-3 hover:bg-black/[0.02] rounded-xl transition-all cursor-pointer border border-transparent hover:border-black/5">
              <p className="text-[14px] font-black uppercase tracking-tight truncate">#{topic}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panel 2: Feed - 7/10 width on desktop */}
      <div className="w-full md:w-[70%] md:pl-10 h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-6 w-full">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30" />
            <input 
              type="text" 
              placeholder="Search feed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 border-none rounded-lg py-2 pl-9 pr-4 text-[10px] font-bold focus:ring-2 focus:ring-black/10 outline-none transition-all placeholder:uppercase placeholder:tracking-tighter"
            />
          </div>

          {/* Filter button and dropdown */}
          <div className="relative">
            <button 
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-black/5 hover:bg-black/10 text-black rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter: {filter}</span>
            </button>
            
            <AnimatePresence>
              {isFilterDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsFilterDropdownOpen(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-1 w-32 bg-white border border-black/5 rounded-lg shadow-xl z-20 py-1"
                  >
                    {(['All', 'Following', 'Saved'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setFilter(t);
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider hover:bg-black/5 transition-all ${filter === t ? 'text-venus-accent font-black' : 'text-black/60'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Inline Post Bar */}
        <div className="bg-black/5 p-4 rounded-xl mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 text-black/60">Ask a question to the community</p>
          <input 
            type="text"
            placeholder="Post Title (Optional)"
            value={postTitle}
            onChange={(e) => setPostTitle(e.target.value)}
            className="w-full bg-white border-none rounded-lg py-2 px-3 text-[11px] font-bold focus:ring-1 focus:ring-black outline-none mb-2"
          />
          <input 
            type="text"
            placeholder="What's on your mind?"
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreatePost()}
            className="w-full bg-white border-none rounded-lg py-2 px-3 text-[11px] font-bold focus:ring-1 focus:ring-black outline-none mb-3"
          />
          <div className="flex items-center justify-between">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={(e) => setPostImage(e.target.files?.[0] || null)}
              className="hidden"
              accept="image/*"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center gap-2 text-[10px] font-black uppercase cursor-pointer ${postImage ? 'text-venus-accent' : 'text-black'}`}
            >
              <Camera className="w-4 h-4" />
              {postImage ? 'Image Attached' : 'Attach Photo'}
            </button>
            <button 
              onClick={handleCreatePost}
              disabled={!postContent.trim()}
              className="text-[9px] font-black uppercase tracking-widest bg-black text-white px-6 py-2 rounded-lg hover:bg-venus-accent transition-all disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>

        <div className="space-y-4 pb-32">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-black/5 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            displayPosts.map(post => (
              <div key={post.post_id} className="bg-white border border-black/5 rounded-xl overflow-hidden hover:border-black/20 transition-all">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-venus-accent/20 border border-black flex items-center justify-center text-[9px] font-black">
                        {post.users?.username?.[0] || 'U'}
                      </div>
                      <div>
                        <h4 className="text-[9px] font-black uppercase tracking-tight leading-none">{post.users?.username || 'Anonymous'}</h4>
                        <p className="text-[7px] text-black/40 font-bold">@{post.users?.skin_type || 'member'} • {new Date(post.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="text-black/20 hover:text-black">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {post.title && (
                    <h3 className="text-[9px] font-black uppercase tracking-tight mb-0.5 text-venus-accent">{post.title}</h3>
                  )}
                  <p className="text-[11px] font-medium leading-normal mb-3 text-black/80">{post.content}</p>
                  
                  {post.post_media && (
                    <div className="rounded-lg overflow-hidden border border-black/5 mb-3">
                      <img src={post.post_media} className="w-full max-h-48 object-cover" alt="Post media" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 pt-2 border-t border-black/5">
                    <button className="flex items-center gap-1 text-black/40 hover:text-venus-accent transition-colors">
                      <Heart className="w-3 h-3" />
                      <span className="text-[8px] font-black">0</span>
                    </button>
                    <button 
                      onClick={() => setCommentsOpenPostId(commentsOpenPostId === post.post_id ? null : post.post_id)}
                      className="flex items-center gap-1 text-black/40 hover:text-black transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span className="text-[8px] font-black">{comments[post.post_id]?.length || 0}</span>
                    </button>
                    <button className="flex items-center gap-1 text-black/40 hover:text-black transition-colors ml-auto">
                      <Share2 className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {commentsOpenPostId === post.post_id && (
                    <div className="mt-4 pt-4 border-t border-black/5 space-y-4">
                      {comments[post.post_id]?.map(c => (
                        <div key={c.id} className="text-[10px] bg-black/5 p-2 rounded-lg">
                          <span className="font-black mr-1 uppercase">{c.users?.username || 'U'}:</span>
                          {c.content}
                        </div>
                      ))}
                      
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleComment(post.post_id)}
                          placeholder="Write a comment..."
                          className="flex-1 bg-black/5 border-none rounded-lg py-2 px-3 text-[10px] font-bold focus:ring-1 focus:ring-black outline-none"
                        />
                        <button 
                          onClick={() => handleComment(post.post_id)}
                          className="px-3 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase hover:bg-venus-accent transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile Floating Action Button removed */}

      {/* Mobile Follows Sidebar */}
      <AnimatePresence>
        {isFollowsOpen && (
          <React.Fragment key="social-modal">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFollowsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[70] p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-black" />
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">Social</h2>
                </div>
                <button 
                  onClick={() => setIsFollowsOpen(false)}
                  className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 mb-6">
                  {['Messages', 'Friends'].map(t => (
                      <button key={t} onClick={() => setSocialTab(t as 'Messages' | 'Friends')} className={`text-xs font-black uppercase tracking-tight ${socialTab === t ? 'text-black' : 'text-black/40'}`}>
                          {t}
                      </button>
                  ))}
              </div>

               {socialTab === 'Friends' ? (
                 <>
                   {/* User Search Bar */}
                   <div className="relative mb-6">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                     <input 
                       type="text" 
                       placeholder="Search users..."
                       value={userSearch}
                       onChange={(e) => setUserSearch(e.target.value)}
                       className="w-full bg-black/5 border-none rounded-xl py-3 pl-10 pr-4 text-[11px] font-bold focus:ring-2 focus:ring-black/10 outline-none transition-all placeholder:uppercase placeholder:tracking-tighter"
                     />
                   </div>

                 <div className="space-y-4 flex-1 overflow-y-auto">
                   {userSearch ? (
                       userSearchResults.length > 0 ? (
                           userSearchResults.map(u => (
                               <div key={u.id} className="flex items-center justify-between gap-3 p-3 hover:bg-black/5 rounded-xl transition-colors cursor-pointer border border-transparent">
                                 <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full border-2 border-black bg-venus-accent/10 flex items-center justify-center font-black">
                                     {u.username?.[0] || '?'}
                                   </div>
                                   <p className="text-xs font-black uppercase tracking-tight">{u.username}</p>
                                 </div>
                                 <button onClick={() => handleFollow(u.id)} className="text-[9px] font-black uppercase py-1 px-3 bg-black text-white rounded-lg">Follow</button>
                               </div>
                              ))
                       ) : (
                           <p className="text-xs text-black/40 font-bold uppercase italic text-center p-4">No users found</p>
                       )
                   ) : (
                       follows.map(f => (
                       <div key={f.id} className="flex items-center gap-3 p-3 hover:bg-black/5 rounded-xl transition-colors cursor-pointer border border-transparent">
                           <div className="w-10 h-10 rounded-full border-2 border-black bg-venus-accent/10 flex items-center justify-center font-black">
                           {f.following?.username?.[0] || '?'}
                           </div>
                           <div>
                           <p className="text-xs font-black uppercase tracking-tight">{f.following?.username || 'User'}</p>
                           <p className="text-[10px] text-black/40 font-bold uppercase">{f.following?.skin_type || 'Friend'}</p>
                           </div>
                       </div>
                       ))
                   )}
                 </div>
                 </>
               ) : (
                 <MessagesTab />
               )}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
};

