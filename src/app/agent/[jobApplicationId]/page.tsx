import ChatBot from "@/app/components/Agent";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";

function validateJobApplicationNumber(jobApplicationNumber: string): boolean {
  const jaParts = jobApplicationNumber.split("-");
  if (jaParts.length !== 2) {
    return false;
  }
  const jaPrefix = jaParts[0].toUpperCase();
  if (jaPrefix !== "JAR") {
    return false;
  }
  if (!/^\d{4}$/.test(jaParts[1])) {
    return false;
  }
  return true;
}

export default async function Agent({
  params,
}: {
  params: Promise<{ jobApplicationId: string }>;
}) {
  const { jobApplicationId } = await params;
  const jobApplicationNumber = jobApplicationId.toUpperCase();

  if (!validateJobApplicationNumber(jobApplicationNumber)) {
    return (
      <div className="min-h-screen bg-adecco-light-gradient">
        <Header currentPage="agent" />
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              400: Invalid Request
            </h1>
            <p className="text-gray-600">
              The job application number format is invalid.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
  return (
    <div>
      <Header currentPage="agent" />
      <ChatBot jobApplicationNumber={jobApplicationNumber} />
      <Footer />
    </div>
  );
}
