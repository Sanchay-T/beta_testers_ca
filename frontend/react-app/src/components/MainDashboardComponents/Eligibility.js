import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import { Phone, Mail, AlertCircle, ChevronRight } from "lucide-react";


export default function Eligibility() {
  const [opportunityData, setOpportunityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // const commissionMap = {
  //   "Business Loan": 1.0,
  //   "Home Loan / Balance Transfer": 0.45,
  //   "Loan Against Property / Balance Transfer": 0.65,
  //   "Term Plan": "1 % -30",
  //   "General Insurance": "upto 10",
  // };

  useEffect(() => {
    async function fetchOpportunityData() {
      try {
        const response = await window.electron.getOpportunityToEarn();

        if (!response.success) {
          throw new Error(response.message);
        }

        const transformedData = response.data.map((item) => ({
          caseName: item.caseName || "Unknown Client",
          statementCustomerName:
            item.statementCustomerName || "No Statement Data",
          homeLoanValue: {
            type: "Home Loan / Balance Transfer",
            amount: item.homeLoanValue || 0,
            rate: "0.45%",
            value: (item.homeLoanValue || 0) * 0.0045,
          },
          loanAgainstProperty: {
            type: "Loan Against Property / Balance Transfer",
            amount: item.loanAgainstProperty || 0,
            rate: "0.65%",
            value: (item.loanAgainstProperty || 0) * 0.0065,
          },
          businessLoan: {
            type: "Business Loan",
            amount: item.businessLoan || 0,
            rate: "1.00%",
            value: (item.businessLoan || 0) * 0.01,
          },
          termPlan: {
            type: "Term Plan",
            amount: item.termPlan || 0,
            rate: "1% - 30%",
            value: item.termPlan || 0,
          },
          generalInsurance: {
            type: "General Insurance",
            amount: item.generalInsurance || 0,
            rate: "upto 10%",
            value: item.generalInsurance || 0,
          },
        }));

        setOpportunityData(transformedData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching opportunity data:", err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchOpportunityData();
  }, []);

  const note = [
    {
      title: "To Proceed Further:",
      content: `In case your client is interested in any of the above products, you can contact our trusted vendor M/s BizPedia Tech Private Limited on 8828824242 and email id support@leadsathi.in. Kindly use the promo code "CYPHERSOLEARN" to avail the higher commission structure.
  
      Once the referrals are successfully closed, you will be eligible for payouts based on the above commission structure.
  
      The respective payments will be released on the 25th of the next month.`,
    },
    {
      title: "Disclaimer:",
      content: [
        "The above loan eligibility calculations apply to self-employed clients only.",
        "For salaried clients, the vendor will need more details to calculate the eligibility.",
        "The above eligibility is based on the analysis of the current uploaded bank statement. Kindly upload all bank statements to obtain more accurate eligibility.",
        "Final Approval will be dependent on complete thorough process and submission of relevant documents, CIBIL check, etc.",
        "Nothing contained in this eligibility should be deemed to create any right and/or interest whatsoever in favor of or against any party.",
      ],
    },
  ];

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error loading data: {error}</div>;
  // if (!opportunityData || opportunityData.length === 0)
  //   return <div>No data available</div>;

  return (
    <ScrollArea className="h-full">
      <div className="p-8 pt-0 space-y-8">
        <div className="text-left">
          <h2 className="text-3xl font-extrabold to-blue-400 dark:text-slate-300">
            Opportunity to Earn
          </h2>
          <p className="text-gray-600 mt-2 dark:text-[#7F8EA3]">
            Discover the products you're eligible for and the associated
            benefits.
          </p>
        </div>
        {!opportunityData || opportunityData.length === 0 ? (
          <div className="bg-gray-100 p-4 rounded-md w-full h-[10vh]">
            <p className="text-gray-800 text-center mt-3 font-medium text-lg">
            Run more statements to earn more
            </p>
          </div>
        ) : (
          <Card className="px-6 rounded-lg">
            <Accordion type="single" collapsible className="w-full">
              {opportunityData.map((data, index) => (
                <AccordionItem key={index} value={`item-${index + 1}`}>
                  <AccordionTrigger className="from-neutral-500">
                    <div className="flex flex-col items-start gap-y-1">
                      <span className="text-[18px] font-semibold">
                        {data.statementCustomerName}
                      </span>
                      <span className="text-[15px] font-normal text-gray-600">
                        Report Name: {data.caseName}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className=" py-4">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableHead className="font-semibold">
                              Product
                            </TableHead>
                            <TableHead className="text-center font-semibold">
                              Amount
                            </TableHead>
                            <TableHead className="text-center font-semibold">
                              Commission %
                            </TableHead>
                            <TableHead className="text-right font-semibold">
                              Commission (₹)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(data)
                            .filter(
                              ([key]) =>
                                !["caseName", "statementCustomerName"].includes(
                                  key
                                )
                            )
                            .map(([key, item]) => (
                              <TableRow
                                key={key}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <TableCell className="font-medium">
                                  {item.type}
                                </TableCell>
                                <TableCell className="text-center">
                                  ₹
                                  {item.amount.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.rate}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  ₹
                                  {item.value.toLocaleString(undefined, {
                                    maximumFractionDigits: 2,
                                  })}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Important Notes
            </h4>
            <ul className="space-y-3">
              {note[1].content.map((item, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 text-gray-600 dark:text-slate-300"
                >
                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6 space-y-4">
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              Contact Information
            </h4>
            <div className="space-y-4 text-gray-600 dark:text-slate-300">
              <p>
                In case your client is interested in any of the above products,
                you can contact our trusted vendor M/s BizPedia Tech Private
                Limited using below contact details.
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                +91 8828824242
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                support@leadsathi.in
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Use promo code: "CYPHERSOLEARN" for higher commission rates
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
