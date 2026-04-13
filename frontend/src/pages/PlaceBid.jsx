import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import "../styles/PlaceBid.css";

export default function PlaceBid(){

  const { id } = useParams();
  const navigate = useNavigate();

  const [price,setPrice] = useState("");
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);

  const token = localStorage.getItem("token");

  const handleSubmit = async (e)=>{
    e.preventDefault();

    setLoading(true);

    try{

      const res = await fetch("http://localhost:5000/api/bids",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:`Bearer ${token}`
        },
        body:JSON.stringify({
          gigId:id,
          price,
          message
        })
      });

      const data = await res.json();

      if(res.ok){
  alert("Bid submitted successfully");
  navigate("/profile?tab=bids");
}else{
        alert(data.message);
      }

    }catch(err){
      console.log(err);
    }

    setLoading(false);
  }

  return(

    <div className="place-bid-container">

      <div className="bid-card">

        <h1>Submit Your Bid</h1>
        <p className="bid-subtitle">
          Tell the client how you will complete this project
        </p>

        <form onSubmit={handleSubmit}>

          <div className="form-group">

            <label>Your Price ($)</label>

            <input
            type="number"
            placeholder="Enter your offer"
            value={price}
            onChange={(e)=>setPrice(e.target.value)}
            required
            />

          </div>

          <div className="form-group">

            <label>Proposal Message</label>

            <textarea
            placeholder="Explain how you will complete the project..."
            value={message}
            onChange={(e)=>setMessage(e.target.value)}
            required
            />

          </div>

          <div className="bid-actions">

            <button
            type="button"
            className="cancel-btn"
            onClick={()=>navigate(-1)}
            >
              Cancel
            </button>

            <button
            type="submit"
            className="submit-btn"
            disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Bid"}
            </button>

          </div>

        </form>

      </div>

    </div>

  )
}