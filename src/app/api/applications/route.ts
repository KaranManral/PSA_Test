// This API route handles job applications by creating or finding a candidate and submitting a job application in Salesforce.
// It authenticates with Salesforce, checks for an existing candidate, creates one if needed, and then creates a job application record.
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getSalesforceAccessV2Token } from "@/app/lib/salesforceAuthV2";

const SF_DOMAIN = process.env.SF_DOMAIN ?? "";
const SF_CREATE_JOB_APPLICATION =
  process.env.Create_Job_Application_FLOW_NAME ?? "";

export async function POST(request: NextRequest) {
  try {
    // Get Salesforce access token and instance URL
    const response = await getSalesforceAccessV2Token();
    const { access_token } = await response.json();

    // Parse application data from the request body
    const applicationData = await request.json();

    try {
          const createJobApplicationURL = `${SF_DOMAIN}/services/data/v64.0/actions/custom/flow/${SF_CREATE_JOB_APPLICATION}`;
    
          const flowData = {
            inputs: [
              {
                jobId: applicationData.jobId,
                name: `${applicationData.firstName.trim()} ${applicationData.lastName.trim()}`,
                mobile: applicationData.mobile,
                email: applicationData.email,
                pinCode: Number(applicationData.postalCode),
                address: `${applicationData.street.trim()}, ${applicationData.city.trim()}, ${applicationData.stateProvince.trim()}, ${applicationData.country.trim()}`,
                country: applicationData.country,
              },
            ],
          };
          interface FlowResponse {
            actionName: string;
            errors: Array<{
              statusCode: string;
              message: string;
              fields: string[];
            }> | null;
            invocationId: string | null;
            isSuccess: boolean;
            outcome: string | null;
            outputValues: {
              jobApplicationNumber: string | null;
              statusMessage: string | null;
              Flow__InterviewStatus?: string | null;
              [key: string]: unknown;
            };
            sortOrder: number;
            version: number;
          }
          
          const flowResponse = (
            await axios.post<FlowResponse[]>(createJobApplicationURL, flowData, {
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
            })
          ).data;
    
          if (!flowResponse[0].isSuccess) {
            // If the flow execution fails, return an error response
            return NextResponse.json(
              { message: "Flow execution failed", sessionId: "" },
              { status: 500 }
            );
          }
          
          if(!flowResponse[0].outputValues || !flowResponse[0].outputValues.jobApplicationNumber || !flowResponse[0].outputValues.statusMessage){
            return NextResponse.json({message:"Failed to create job application",jobApplicationNumber:""},{status:500});
          }

          if(flowResponse[0].outputValues.statusMessage === "fail"){
            return NextResponse.json({message:"Failed to create job application",jobApplicationNumber:""},{status:500});
          }

          return NextResponse.json({message:flowResponse[0].outputValues.statusMessage,jobApplicationNumber:flowResponse[0].outputValues.jobApplicationNumber},{status:200});
    
        } catch (error) {
          // Handle errors in calling the flow
          console.log("Error creating job application: " + error);
          return NextResponse.json(
            {
              message: "Flow execution failed",
              sessionId: "",
            },
            { status: 500 }
          );
        }
      } catch (error) {
        // Handle errors in getting the access token
        console.log("Error getting access token: " + error);
        return NextResponse.json(
          { message: "failed", access_token: "" },
          { status: 500 }
        );
      }
    }
    