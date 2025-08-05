'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  const footerSections = [
    {
      title: 'ABOUT US',
      links: [
        { name: 'WHO WE ARE', href: '#about#who-we-are' },
        { name: 'ESG', href: '#about#esg' },
        { name: 'PURPOSE AND IMPACT', href: '#about#purpose-impact' },
      ]
    },
    {
      title: 'CANDIDATES',
      links: [
        { name: 'JOB SEARCH', href: '#jobs' },
        { name: 'BROWSE JOB TYPES', href: '#jobs#types' },
        { name: 'BROWSE JOB INDUSTRIES', href: '#jobs#industries' },
      ]
    },
    {
      title: 'EMPLOYERS',
      links: [
        { name: 'SERVICES', href: '#employers#services' },
        { name: 'INDUSTRIES', href: '#employers#industries' },
        { name: 'PRIVATE SECTOR', href: '#employers#private-sector' },
      ]
    },
    {
      title: 'FEATURED EMPLOYERS',
      links: [
        { name: 'AMAZON', href: '#employers#amazon' },
        { name: 'HELLO FRESH', href: '#employers#hello-fresh' },
        { name: 'WALMART', href: '#employers#walmart' },
      ]
    }
  ];

  return (
    <footer className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Logo Section */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center mb-6">
              <img 
                src="/home-logo.svg" 
                alt="Adecco" 
                className="h-8 w-auto filter brightness-0 invert"
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

          {/* Footer Links */}
          {footerSections.map((section) => (
            <div key={section.title} className="md:col-span-1">
              <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-300 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2025 Adecco Group. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <Link
                href="#privacy"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Privacy Policy
              </Link>
              <Link
                href="#terms"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Terms of Service
              </Link>
              <Link
                href="#cookies"
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
