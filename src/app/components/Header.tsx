'use client';

import React, { useEffect, useState } from 'react';
import { Menu, X, Search } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  currentPage?: string;
}

export function Header({ currentPage }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  useEffect(()=>{
    console.log(currentPage);
  },[currentPage]);

  const navItems = [
    { name: 'CANDIDATE', href: '#', hasSubmenu: true },
    { name: 'EMPLOYERS', href: '#', hasSubmenu: true },
    { name: 'INDUSTRIES', href: '#', hasSubmenu: true },
    { name: 'ABOUT US', href: '#', hasSubmenu: true },
    { name: 'NEWS', href: '#', hasSubmenu: false },
    { name: 'JOIN OUR TEAM', href: '#', hasSubmenu: true },
  ];

  const topNavItems = [
    { name: 'TIMESHEETS', href: '#' },
    { name: 'CAREERS AT ADECCO', href: '#' },
    { name: 'ONLINE CENTRE', href: '#' },
    { name: 'PAYROLL', href: '#' },
  ];

  return (
    <>
      {/* Top Navigation Bar */}
      <div className="bg-white text-black text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-end items-center py-2 gap-x-6">
            <div className="hidden md:flex space-x-6">
              {topNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-xs">🌐</span>
                <span className="text-xs">AUSTRALIA (ENGLISH)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-adecco-gradient shadow-lg relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <img 
                  src="/home-logo.svg" 
                  alt="Adecco" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    // Fallback to text if SVG doesn't exist
                    e.currentTarget.style.display = 'none';
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                    if (nextElement) {
                      nextElement.style.display = 'block';
                    }
                  }}
                />
                <div className="text-white font-bold text-2xl tracking-wider" style={{display: 'none'}}>
                  Adecco
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8">
              {navItems.map((item) => (
                <div key={item.name} className="relative group">
                  <Link
                    href={item.href}
                    className="text-white hover:text-red-100 transition-colors font-medium text-sm tracking-wide flex items-center"
                  >
                    {item.name}
                    {item.hasSubmenu && (
                      <svg
                        className="ml-1 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    )}
                  </Link>
                  {item.hasSubmenu && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white shadow-lg rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="py-2">
                        <Link
                          href={`${item.href}/option1`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-adecco-red"
                        >
                          Option 1
                        </Link>
                        <Link
                          href={`${item.href}/option2`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-adecco-red"
                        >
                          Option 2
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Contact Button - Desktop */}
            <div className="hidden lg:flex items-center space-x-4">
              <Link
                href="#contact"
                className="bg-white text-adecco-red px-6 py-2 rounded-md font-semibold hover:bg-red-50 transition-colors text-sm"
              >
                CONTACT
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-white hover:text-red-100 transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-adecco-red border-t border-red-400">
            <div className="px-4 py-2 space-y-1">
              {/* Search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search for..."
                  className="w-full px-4 py-2 pr-10 text-gray-900 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-white"
                />
                <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>

              {/* Country Selector */}
              <div className="border-b border-red-400 pb-4 mb-4">
                <div className="flex items-center text-white text-sm">
                  <span className="mr-2">🌐</span>
                  <span>AUSTRALIA (ENGLISH)</span>
                </div>
              </div>

              {/* Navigation Items */}
              {navItems.map((item) => (
                <div key={item.name} className="border-b border-red-400 py-3">
                  <Link
                    href={item.href}
                    className="text-white hover:text-red-100 transition-colors font-medium text-sm tracking-wide flex items-center justify-between"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {item.name}
                    {item.hasSubmenu && (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </Link>
                </div>
              ))}

              {/* Additional Links */}
              <div className="pt-4 space-y-3">
                <Link
                  href="#contact"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  CONTACT
                </Link>
                <Link
                  href="#timesheets"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  TIMESHEETS
                </Link>
                <Link
                  href="#careers"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  CAREERS AT ADECCO
                </Link>
                <Link
                  href="#online-centre"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ONLINE CENTRE
                </Link>
                <Link
                  href="#payroll"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  PAYROLL
                </Link>
                <Link
                  href="#news"
                  className="block text-blue-200 hover:text-white transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  NEWS
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
