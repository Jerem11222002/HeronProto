import React, { useState } from "react";
import RecommendationModal from "../components/modals/RecommendationModal";

export default function RecommendationTest() {
  const [isModalOpen, setIsModalOpen] = useState(true); // Auto-open for demo

  return (
    <div style={{
      padding: "40px",
      backgroundColor: "#f5f5f5",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        maxWidth: "600px",
        width: "100%",
        backgroundColor: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
      }}>
        <h1 style={{ margin: "0 0 16px", color: "#333", fontSize: "28px" }}>
          📊 Your Personalized Recommendations
        </h1>
        
        <p style={{
          margin: "0 0 24px",
          color: "#666",
          fontSize: "16px",
          lineHeight: "1.6"
        }}>
          Click the button below to view your personalized recommendations based on your interests. 
          The system analyzes your profile and shows you curated posts and events with explanations for why they were recommended.
        </p>

        <div style={{
          backgroundColor: "#f9f9f9",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
          fontSize: "14px",
          color: "#666"
        }}>
          <p style={{ margin: "0 0 8px", fontWeight: "600" }}>📈 What You'll See:</p>
          <ul style={{ margin: "0", paddingLeft: "20px", lineHeight: "1.8" }}>
            <li>Recommended posts and events tailored to your interests</li>
            <li>Why each item was recommended (matching tags, engagement, recency, etc.)</li>
            <li>ISO 25010 Functional Suitability metrics to evaluate recommendation quality</li>
            <li>Your profile information and interests</li>
          </ul>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            width: "100%",
            padding: "14px 24px",
            backgroundColor: "#5271ff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.3s",
            boxShadow: "0 4px 12px rgba(82, 113, 255, 0.3)"
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#748ffc";
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 6px 16px rgba(82, 113, 255, 0.4)";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "#5271ff";
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 12px rgba(82, 113, 255, 0.3)";
          }}
        >
          🚀 Open Recommendations
        </button>

        <p style={{
          margin: "24px 0 0",
          color: "#999",
          fontSize: "13px",
          textAlign: "center"
        }}>
          Your recommendations are generated based on your interests and the content available in the system.
        </p>
      </div>

      {/* Recommendation Modal */}
      <RecommendationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
