// Home page for the adecco recruiter application.
// Displays job listings, job details modal, and application form modal.
"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  CheckCircle,
} from "lucide-react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { JobCard } from "./components/JobCard";
import { ApplicationForm } from "./components/ApplicationForm";
import { SearchFilters } from "./components/SearchFilters";
import { JobDetailModal } from "./components/JobDetails";
import { Job, CreateApplicationData } from "./types";

export default function Home() {
  // State for job data, UI flags, and filters
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isApplicationFormOpen, setIsApplicationFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Fetch jobs from the API on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Fetches job data from the backend API
  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) {
        if(res.status === 404)
          throw new Error("No Jobs Listed");
        if(res.status === 500)
          throw new Error("Unable to fetch Jobs")
      }
      const data: Job[] = await res.json();
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filters jobs based on search, location, and type
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLocation =
        !locationFilter ||
        job.location.toLowerCase().includes(locationFilter.toLowerCase());

      const matchesType = !typeFilter || job.type === typeFilter;

      return matchesSearch && matchesLocation && matchesType;
    });
  }, [jobs, searchQuery, locationFilter, typeFilter]);

  // Opens the application form for a selected job
  const handleApplyToJob = (job: Job) => {
    setSelectedJob(job);
    setIsApplicationFormOpen(true);
  };

  // Handles application form submission and shows success message
  const handleSubmitApplication = async (
    applicationData: CreateApplicationData
  ) => {
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(applicationData),
      });

      if (response.ok && response.status === 200) {
        setShowSuccessMessage(true);
        const data:{message:string,jobApplicationNumber:string} = await response.json();
        alert(`${data.message}, Your Job Application Number is: ${data.jobApplicationNumber}`);
        setTimeout(() => setShowSuccessMessage(false), 5000);
      }
    } catch (error) {
      console.error("Failed to submit application:", error);
    }
  };

  // Opens the job details modal
  const openJobDetail = (job: Job) => {
    setDetailJob(job);
  };

  // Closes the application form modal
  const closeApplicationForm = () => {
    setIsApplicationFormOpen(false);
    setSelectedJob(null);
  };

  if (loading) {
    // Show loading spinner while jobs are being fetched
    return (
      <div className="min-h-screen bg-adecco-light-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-adecco-red mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-adecco-light-gradient">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 bg-poetic-green text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Application submitted successfully!
        </div>
      )}

      {/* Header */}
      <Header currentPage="home" />

      {/* Hero Section */}
      <div className="flex items-center h-96 bg-cover bg-center bg-no-repeat max-lg:bg-transparent lg:bg-[url(/hero-img.webp)]">
        <div className="relative bg-white z-10 p-4 max-lg:w-full w-[664px] lg:ml-[15vw] lg:h-4/5 flex items-center lg:rounded-xl lg:shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-sans text-black mb-6 leading-tight">
                Adecco works for everyone
              </h1>
              <p className="text-md text-black mb-8 leading-relaxed">
                Making a career move or seeking a new addition to your team? Whatever your needs, Adecco has endless opportunities for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="btn-adecco-primary text-sm cursor-pointer">
                  SUBMIT VACANCY
                </button>
                <button className="text-blue-400 border-2 border-white hover:bg-white hover:text-gray-800 px-8 py-3 rounded-md text-sm transition-colors">
                  LATEST JOBS
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Jobs Grid */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {filteredJobs.length === jobs.length
                ? `Featured Jobs (${jobs.length})`
                : `Filtered Jobs (${filteredJobs.length} of ${jobs.length})`}
            </h2>
          </div>

          {/* Search and Filters */}
          <SearchFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            locationFilter={locationFilter}
            onLocationChange={setLocationFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
          />

          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border-l-4 border-adecco-red">
              <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {jobs.length === 0
                  ? "No jobs posted yet"
                  : "No jobs match your filters"}
              </h3>
              <p className="text-gray-500 mb-6">
                {jobs.length === 0
                  ? "Be the first to post a job opportunity!"
                  : "Try adjusting your search criteria to find more opportunities."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={openJobDetail}
                  onApply={handleApplyToJob}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      {/* Job Details */}
      {detailJob && (
        <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} />
      )}

      {/* Application Form Modal */}
      <ApplicationForm
        job={selectedJob}
        onSubmit={handleSubmitApplication}
        onClose={closeApplicationForm}
        isOpen={isApplicationFormOpen}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
