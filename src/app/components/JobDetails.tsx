// JobDetailModal component displays detailed information about a selected job in a modal dialog.
// Shows job title, company, location, post date, description, responsibilities, skills, and a close button.
import React from 'react';
import { Job } from '../types';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

// Props for JobDetailModal: job data and close handler
type Props = {
  job: Job;
  onClose: () => void;
};

export function JobDetailModal({ job, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-3xl w-full p-8 relative max-h-[90vh] overflow-y-auto shadow-2xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-adecco-red"
          >
            <X size={24} />
          </button>

          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{job.title}</h2>
            <p className="text-lg text-gray-600">
              {job.company} <span className="mx-2 text-adecco-red">•</span> {job.location}
            </p>
            <p className="text-sm text-gray-500">
              Posted on {new Date(job.postDate).toLocaleDateString()}
            </p>
          </div>

          {/* Sections */}
          <section className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{__html:  DOMPurify.sanitize(job.description||"No Description")}}></p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Skills Required</h3>
            <div className="flex flex-wrap gap-2" dangerouslySetInnerHTML={{__html:  DOMPurify.sanitize(job.skills||"No Description")}}>
            </div>
          </section>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="btn-adecco-primary px-6 py-2 font-medium shadow-md"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
