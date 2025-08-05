// ApplicationForm component provides a detailed form for users to apply to a job position.
// Handles form state, validation, and submission to the backend, supporting a wide range of candidate fields.
'use client';

import React, { useState } from 'react';
import {
  X, User, Mail, MapPin, Briefcase,
  Smartphone, Globe // New icons
} from 'lucide-react';
import { Job, CreateApplicationData } from '../types'; // Assuming CreateApplicationData will be updated

interface ApplicationFormProps {
  job: Job | null;
  onSubmit: (data: CreateApplicationData) => Promise<void>;
  onClose: () => void;
  isOpen: boolean;
}

// FormDataType defines the structure of the application form's state
// This should mirror the structure of CreateApplicationData (excluding jobId)
interface FormDataType {

  jobId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  postalCode: string;
  street: string;
  city: string;
  stateProvince: string;
  country: "India"|"Australia"|"Poland"|"Italy"|"France"|"UK";
}

// initialFormData provides default values for the form
const initialFormData: FormDataType = {
  jobId: '', //remove if causes error
  firstName: '',
  lastName: '',
  mobile: '',
  email: '',
  postalCode: '',
  street: '',
  city: '',
  stateProvince: '',
  country: 'UK'
};

// validationRules defines max length for each field for validation
// based on maxLength in JSX
const validationRules: Record<keyof FormDataType, number> = {
  firstName: 50,
  lastName: 50,
  mobile: 12,
  email: 50,
  postalCode: 15,
  street: 50,
  city: 50,
  stateProvince: 50,
  country: 50,
  jobId: 18
};

export function ApplicationForm({ job, onSubmit, onClose, isOpen }: ApplicationFormProps) {
  // State for form data, errors, and submission status
  const [formData, setFormData] = useState<FormDataType>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormDataType, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validates the form fields based on max length
  const validateForm = () => {
    const newErrors: typeof errors = {};
    (Object.keys(validationRules) as (keyof FormDataType)[]).forEach(field => {
      const max = validationRules[field];
      const value = formData[field];
      if (typeof value === 'string' && value.length > max) {
        newErrors[field] = `${field} must be at most ${max} characters`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handles form submission, calls onSubmit prop, and resets state
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submissionData: CreateApplicationData = {
        ...formData,
        jobId: job.id,
      };
      await onSubmit(submissionData);
      onClose();
      setFormData(initialFormData); // Reset form
      setErrors({});
    } catch (error) {
      console.error('Failed to submit application:', error);
      // Potentially show an error message to the user
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handles changes to form fields, including checkboxes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const { checked } = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    const key = name as keyof FormDataType;
    // clear error on change
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Briefcase className="w-6 h-6 text-adecco-red mr-3" />
              <h2 className="text-2xl font-bold text-gray-900">Apply for Position</h2>
            </div>
            <div className="text-gray-600">
              <p className="font-semibold">{job.title}</p>
              <p className="text-sm">{job.company} • {job.location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-adecco-red hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" /> First Name *
              </label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required className="input-field" placeholder="John" maxLength={50} />
            {errors.firstName && <p className="text-red-600 text-sm">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" /> Last Name *
              </label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required className="input-field" placeholder="Doe" maxLength={50} />
            {errors.lastName && <p className="text-red-600 text-sm">{errors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" /> Email Address *
              </label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required className="input-field" placeholder="john.doe@email.com" />
            {errors.email && <p className="text-red-600 text-sm">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Smartphone className="w-4 h-4 inline mr-2" /> Mobile Number *
              </label>
              <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required className="input-field" placeholder="+1 (555) 123-4567" />
            {errors.mobile && <p className="text-red-600 text-sm">{errors.mobile}</p>}
            </div>
          </div>

          {/* Address Information */}
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4 mt-6">Address Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" /> Street Address (Optional)
              </label>
              <input type="text" name="street" value={formData.street} onChange={handleChange} className="input-field" placeholder="123 Main St" maxLength={50} />
            {errors.street && <p className="text-red-600 text-sm">{errors.street}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" /> City *
              </label>
              <input type="text" name="city" value={formData.city} onChange={handleChange} required className="input-field" placeholder="Anytown" maxLength={50} />
            {errors.city && <p className="text-red-600 text-sm">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" /> State/Province *
              </label>
              <input type="text" name="stateProvince" value={formData.stateProvince} onChange={handleChange} required className="input-field" placeholder="CA / Ontario" maxLength={50} />
            {errors.stateProvince && <p className="text-red-600 text-sm">{errors.stateProvince}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" /> Zip/Postal Code *
              </label>
              <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} required className="input-field" placeholder="90210 / M5V 2T6" maxLength={15} />
            {errors.postalCode && <p className="text-red-600 text-sm">{errors.postalCode}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Globe className="w-4 h-4 inline mr-2" /> Country *
              </label>
              <select name="country" id="country" value={formData.country} onChange={handleChange} required className="input-field">
                <option value="India">India</option>
                <option value="Australia">Australia</option>
                <option value="Poland">Poland</option>
                <option value="Italy">Italy</option>
                <option value="France">France</option>
                <option value="UK">UK</option>
              </select>
            {errors.country && <p className="text-red-600 text-sm">{errors.country}</p>}
            </div>
          </div>

          {/* Submission Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-adecco-secondary px-6 py-3 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-adecco-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
      {/* Basic styles for input fields (add to your global CSS or a <style jsx> block if needed) */}
      <style jsx global>{`
        .input-field, .textarea-field {
          width: 100%;
          padding: 0.75rem 1rem; /* Equivalent to py-3 px-4 */
          border: 2px solid #D1D5DB; /* border-gray-300 */
          border-radius: 0.5rem; /* rounded-lg */
          transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        .input-field:focus, .textarea-field:focus {
          outline: none;
          border-color: #EE2E24; /* Adecco Red */
          --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
          --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);
          box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
          --tw-ring-color: #EE2E24; /* Adecco Red */
        }
        .textarea-field {
          resize: vertical; /* Allow vertical resize, remove 'resize-none' from original */
        }
        .form-checkbox { /* Basic styling for custom checkboxes if not using a Tailwind plugin */
          appearance: none;
          background-color: #fff;
          border: 2px solid #D1D5DB;
          padding: 0;
          display: inline-block;
          position: relative;
        }
        .form-checkbox:checked {
          background-color: #EE2E24; /* Adecco Red */
          border-color: #EE2E24;
        }
        .form-checkbox:checked::before {
          content: '✔';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-size: 0.75rem; /* Adjust size as needed */
        }
      `}</style>
    </div>
  );
}