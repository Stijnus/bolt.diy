import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from '@remix-run/react';
import { Loader2, MessageCircle, Zap, GitBranch, Clock, MessageSquare, ArrowRight } from 'lucide-react';
import type { ChatHistoryItem } from '~/lib/persistence/useChatHistory';
import type { Project } from './types';

interface ProjectChatsProps {
  project: Project;
  getProjectChats: (projectId: string) => Promise<ChatHistoryItem[]>;
}

export const ProjectChats = ({ project, getProjectChats }: ProjectChatsProps) => {
  const [chats, setChats] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true);

        const projectChats = await getProjectChats(project.id);
        setChats(projectChats);
      } catch (error) {
        console.error('Error loading project chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();
  }, [project.id, getProjectChats]);

  const handleChatClick = (chat: ChatHistoryItem) => {
    const url = `/chat/${chat.urlId || chat.id}`;
    navigate(url);
  };

  const getFeatureName = (featureId?: string) => {
    if (!featureId) {
      return 'Unknown Feature';
    }

    const feature = project.features?.find((f) => f.id === featureId);

    return feature?.name || `Feature ${featureId}`;
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl shadow-sm hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 mt-6">
        <div className="p-6 border-b border-bolt-elements-borderColor">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Associated Chats</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-bolt-elements-textSecondary">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading chats...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl shadow-sm hover:shadow-lg hover:shadow-indigo-500/20 transition-all duration-300 mt-6">
      <div className="p-6 border-b border-bolt-elements-borderColor">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Associated Chats</h2>
          <span className="text-sm text-bolt-elements-textSecondary">
            {chats.length} chat{chats.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="p-6">
        {chats.length > 0 ? (
          <div className="grid gap-3">
            {chats.map((chat) => (
              <motion.button
                key={chat.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => handleChatClick(chat)}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2 rounded-lg cursor-pointer hover:bg-bolt-elements-item-backgroundActive hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-bolt-elements-ring focus:ring-offset-2 w-full text-left"
                aria-label={`Open chat: ${chat.description || 'Untitled Chat'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <MessageCircle className="w-5 h-5 text-bolt-elements-item-contentAccent" />
                    <h4 className="font-medium text-bolt-elements-textPrimary truncate">
                      {chat.description || 'Untitled Chat'}
                    </h4>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-bolt-elements-textSecondary">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {getFeatureName(chat.metadata?.featureId)}
                    </span>

                    {chat.metadata?.gitBranch && (
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {chat.metadata.gitBranch}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(chat.timestamp).toLocaleDateString()}
                    </span>

                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {chat.messages?.length || 0} messages
                    </span>
                  </div>
                </div>

                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent"
                >
                  <ArrowRight className="w-4 h-4" />
                </motion.div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bolt-elements-background-depth-3 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-bolt-elements-textTertiary" />
            </div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No Associated Chats</h3>
            <p className="text-bolt-elements-textSecondary">Start a chat from a feature to see it listed here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
