import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import { Transaction, Category, FamilyMember } from '../types';

interface Message {
  sender: 'user' | 'ai' | 'error';
  text: string;
}

interface AIAssistantProps {
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ transactions, categories, members }) => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: 'Hello! I am your financial assistant. How can I help you analyze your spending today?' }
  ]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom of the chat on new messages
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const generateContext = () => {
    // Sanitize data for the AI prompt
    const context = {
      transactions: transactions.map(({ id, ...t }) => t),
      categories: categories.map(({ id, ...c }) => c),
      members: members.map(({ id, ...m }) => m),
    };
    return JSON.stringify(context, null, 2);
  };

  const handleSendPrompt = async (currentPrompt: string) => {
    if (!currentPrompt.trim()) return;

    setMessages(prev => [...prev, { sender: 'user', text: currentPrompt }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const financialData = generateContext();

      const fullPrompt = `
        System: You are a helpful and friendly financial assistant for a family. Analyze the provided JSON data to answer the user's question. The data includes transactions, categories, and family members. Provide clear, concise, and actionable insights. Do not invent any data not present in the provided context. Format your response using Markdown for readability (e.g., use lists, bold text, tables).

        Here is the financial data:
        ${financialData}

        User's question:
        ${currentPrompt}
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });

      setMessages(prev => [...prev, { sender: 'ai', text: response.text }]);

    } catch (error) {
      console.error("Gemini API error:", error);
      setMessages(prev => [...prev, { sender: 'error', text: 'Sorry, I encountered an error. Please check the API key and try again.' }]);
    } finally {
      setIsLoading(false);
      setPrompt('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(prompt);
  };

  const PromptSuggestion: React.FC<{ text: string }> = ({ text }) => (
    <button
      onClick={() => handleSendPrompt(text)}
      disabled={isLoading}
      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 text-sm text-primary dark:text-blue-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-col h-[70vh] bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white p-6 border-b border-gray-200 dark:border-slate-700">
        AI Financial Assistant
      </h1>
      <div ref={chatContainerRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg p-3 rounded-2xl ${
                msg.sender === 'user' ? 'bg-primary text-white rounded-br-lg' :
                msg.sender === 'ai' ? 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-lg' :
                'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-bl-lg'
            }`}>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}
              />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-lg p-3 rounded-2xl bg-gray-100 dark:bg-slate-700 rounded-bl-lg">
              <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex flex-wrap gap-2 mb-3">
          <PromptSuggestion text="Summarize my spending this month." />
          <PromptSuggestion text="What are my top 3 expense categories?" />
          <PromptSuggestion text="How much income did I receive?" />
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            aria-label="Send prompt"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIAssistant;
