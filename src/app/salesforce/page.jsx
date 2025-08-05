// Salesforce Connector Page with Adecco Theme
"use client";

import { useState } from 'react';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';

export default function SalesforceConnector() {
  const [tokenData, setTokenData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSalesforceToken = async () => {
    setIsLoading(true);
    setError(null);
    setTokenData(null);

    try {
      // Call your OWN internal API route
      const response = await fetch('/api/salesforce/auth', {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle errors from your API route
        throw new Error(data.message || 'Something went wrong');
      }

      setTokenData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-adecco-light-gradient">
      {/* Header */}
      <Header currentPage="salesforce" />
      
      {/* Hero Section */}
      <div className="bg-adecco-gradient shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Salesforce Integration</h1>
            <p className="text-red-100 text-lg">Connect to your Salesforce organization</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card-adecco p-8 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-adecco-red" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Salesforce Connection</h2>
            <p className="text-gray-600">
              Establish a secure connection to your Salesforce organization to access data and functionality.
            </p>
          </div>

          <div className="text-center mb-8">
            <button 
              onClick={getSalesforceToken} 
              disabled={isLoading}
              className={`btn-adecco-primary ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting Token...
                </span>
              ) : (
                'Get Access Token'
              )}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {tokenData && (
            <div className="p-6 bg-green-50 border-l-4 border-poetic-green rounded-r-lg">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-poetic-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800 ml-3">Connection Successful!</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <code className="text-sm text-gray-800 break-all">
                      {tokenData.accessToken.substring(0, 50)}...
                    </code>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instance URL</label>
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <code className="text-sm text-gray-800">{tokenData.instance_url}</code>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mt-4">
                You can now use this token to make API calls to Salesforce.
              </p>
            </div>
          )}

          {/* Additional Information */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">About this Integration</h4>
            <p className="text-sm text-gray-600">
              This secure connection allows the application to interact with your Salesforce data while maintaining 
              the highest security standards. All communications are encrypted and follow industry best practices.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}