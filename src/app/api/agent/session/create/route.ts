/*
  This API route creates a new chat session in Salesforce using the Einstein AI Agent API.
*/

import { getSalesforceAccessV2Token } from "@/app/lib/salesforceAuthV2";
import axios from "axios";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SF_DOMAIN = process.env.SF_DOMAIN ?? "";
const SF_API = process.env.SF_API_HOST ?? "";
const SF_AGENT_ID = process.env.SF_AGENT_ID ?? "";
const SF_GET_ALL_DETAILS_FLOW_NAME =
  process.env.Get_All_Details_From_Application_Number_FLOW_NAME ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobApplicationNumber: string = body.jobApplicationNumber ?? "";
  const termsAndConditionAgreed: string =
    body.termsAndConditionAgreed === true ? "true" : "false";
  try {
    // Get Salesforce access token for API requests
    const response = await getSalesforceAccessV2Token();
    const { access_token } = await response.json();

    try {
      // If jobApplicationNumber is provided, set the flow endpoint to get candidate and job details
      const getAllDetailsFlowEndpoint = `${SF_DOMAIN}/services/data/v64.0/actions/custom/flow/${SF_GET_ALL_DETAILS_FLOW_NAME}`;

      const flowData = {
        inputs: [
          {
            Job_Application_Number: jobApplicationNumber,
          },
        ],
      };

      // // Call the flow to get candidate and job details
      // interface FlowError {
      //     statusCode: string;
      //     message: string;
      //     fields: string[];
      //   }
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
          Candidate_Details?: {
            attributes: {
              type: string;
              url: string;
            } | null;
            Id: string | null;
            Address__c: string | null;
            Country__c: string | null;
            EmailsAddress__c: string | null;
            Mobile_Number__c: string | null;
            Name: string | null;
            Name__c: string | null;
            Pincode__c: number | null;
          } | null;
          Job_Application_Details?: {
            attributes: {
              type: string | null;
              url: string | null;
            };
            Id: string | null;
            Candidate__c: string | null;
            Job_Posting__c: string | null;
            Name: string | null;
          } | null;
          Job_Posting_Details?: {
            attributes: {
              type: string | null;
              url: string | null;
            };
            Id: string | null;
            Description__c: string | null;
            Experience__c: number | null;
            Job_Name__c: string | null;
            location__c: string | null;
            Maximum_Salary__c: number | null;
            Minimum_Salary__c: number | null;
            Name: string | null;
            openings__c: number | null;
            Skills__c: string | null;
            Position__c: string | null;
            Type__c: string | null;
            Work_Mode__c: string | null;
            Company__c: string | null;
          } | null;
          Job_Application_Question_Response?: Array<{
            attributes: {
              type: string | null;
              url: string | null;
            };
            Id: string | null;
            Response__c: string | null;
            Job_Application__c: string | null;
            Pre_Screening_Question__c: string | null;
          }> | null;
          Flow__InterviewStatus?: string | null;
          [key: string]: unknown;
        };
        sortOrder: number;
        version: number;
      }

      const flowResponse = (
        await axios.post<FlowResponse[]>(getAllDetailsFlowEndpoint, flowData, {
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

      if (
        !flowResponse[0].outputValues.Candidate_Details?.Id ||
        !flowResponse[0].outputValues.Candidate_Details.Id
      ) {
        // If candidate or job ID is not found, return an error response
        return NextResponse.json(
          { message: "Invalid Job Application number", sessionId: "" },
          { status: 400 }
        );
      }

      if (flowResponse[0].outputValues.Job_Application_Question_Response&&
        flowResponse[0].outputValues.Job_Application_Question_Response.length >
          0
      ) {
        // If the check flow execution fails, return an error response
        return NextResponse.json(
          {
            message: "Candidate Pre Screening Already Done",
            sessionId: "",
          },
          { status: 403 }
        );
      }

      try {
        // Construct the endpoint for creating a new chat session
        const endpoint = `${SF_API}/einstein/ai-agent/v1/agents/${SF_AGENT_ID}/sessions`;

        // Prepare the session creation payload
        const data = JSON.stringify({
          externalSessionKey: randomUUID(), // Unique session id for tracking
          instanceConfig: {
            endpoint: SF_DOMAIN, // Salesforce instance domain
          },
          tz: "America/Los_Angeles", // Timezone for the session
          variables: [
            {
              name: "$Context.EndUserLanguage",
              type: "Text",
              value: "en_US",
            },
            {
              name: "JobApplicationNumber",
              type: "Text",
              value: jobApplicationNumber, // Pass the job application number to the session
            },
            {
              name: "Job_Application_ID",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Application_Details?.Id ?? "", // Pass the job application id to the session
            },
            {
              name: "jobLocation",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details?.location__c ??
                "", // Get job location from
            },
            {
              name: "candidateId",
              type: "Text",
              value:
                flowResponse[0].outputValues.Candidate_Details.Id ?? "", // Get candidate name from flow
            },
            {
              name: "candidateName",
              type: "Text",
              value:
                flowResponse[0].outputValues.Candidate_Details.Name__c ?? "", // Get candidate name from flow
            },
            {
              name: "candidateEmail",
              type: "Text",
              value:
                flowResponse[0].outputValues.Candidate_Details
                  .EmailsAddress__c ?? "", // Get candidate email from flow
            },
            {
              name: "candidatePhone",
              type: "Text",
              value:
                flowResponse[0].outputValues.Candidate_Details
                  .Mobile_Number__c ?? "", // Get candidate mobile from flow
            },
            {
              name: "candidateCountry",
              type: "Text",
              value:
                flowResponse[0].outputValues.Candidate_Details.Country__c ?? "", // Get candidate country from flow
            },
            {
              name: "jobName",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details?.Job_Name__c ??
                "", // Get job position name from flow
            },
            {
              name: "jobCompanyName",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details?.Company__c ??
                "", // Get job company name from flow
              // value: "Adecco",
            },
            {
              name: "jobType",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details?.Type__c ?? "", // Get job type from flow
            },
            {
              name: "jobWorkMode",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details
                  ?.Work_Mode__c ?? "", // Get job work mode from flow
            },
            {
              name: "jobExperience",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details
                  ?.Experience__c ?? "", // Get job experience from flow
            },
            {
              name: "jobDescription",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details
                  ?.Description__c ?? "", // Get job description from
            },
            {
              name: "jobSkillsRequired",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Posting_Details?.Skills__c ??
                "", // Get job skills from flow
            },
            {
              name: "T_C_Agreed",
              type: "Text",
              value: termsAndConditionAgreed,
            },
            {
              name: "allowUser",
              type: "Text",
              value:
                flowResponse[0].outputValues.Job_Application_Question_Response&&flowResponse[0].outputValues.Job_Application_Question_Response
                  .length > 0
                  ? "false"
                  : "true", // Get allow user flag
            },
          ],
          featureSupport: "Streaming", // Enable streaming support
          streamingCapabilities: {
            chunkTypes: ["Text"],
          },
          bypassUser: true, // Bypass user authentication for demo/testing
        });

        // Create the chat session in Salesforce
        const res = await axios.post(endpoint, data, {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        });
        const { messages, sessionId } = await res.data;
        // Prepare the session object to store in a cookie
        const session = {
          status: "success",
          messages: messages,
          sessionId: sessionId,
        };
        // Set the session cookie and return the session info
        const response = NextResponse.json(session, { status: 200 });
        response.cookies.set("chatSession", JSON.stringify(session), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
        return response;
      } catch (error) {
        // Handle errors in creating the session
        console.log("Error creating session: " + error);
        return NextResponse.json(
          { message: "Session creation failed", sessionId: "" },
          { status: 500 }
        );
      }
    } catch (error) {
      // Handle errors in calling the flow
      console.log("Error calling flow to get candidate data: " + error);
      return NextResponse.json(
        {
          message: "Get Candidate and Job Details Flow execution failed",
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
