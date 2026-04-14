const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { SingleUserRecommendationEvaluator } = require('./backend/scripts/dynamicRecommendationEvaluator');

async function evaluate() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    
    const userId = '674b9dc89ed5aeb9650f3df3'; // cheesecake0101
    const evaluator = new SingleUserRecommendationEvaluator();
    const result = await evaluator.evaluateUser(userId);
    
    // Suppress the debug logs from the evaluator
    console.clear = () => {};
    
    const output = {
      user: result.user ? {
        id: result.user._id,
        username: result.user.username,
        email: result.user.email,
        interests: result.user.interests
      } : null,
      recommendations_count: result.recommendations.length,
      iso_25010_metrics: {
        functional_completeness: result.metrics.functional_completeness,
        functional_correctness: result.metrics.functional_correctness,
        functional_appropriateness: result.metrics.functional_appropriateness,
        total_recommended: result.metrics.total_items_recommended
      },
      hybrid_filtering_metrics: {
        cosine_similarity: result.hybrid_metrics?.cosine_similarity || 0,
        rmse: result.hybrid_metrics?.rmse || 0,
        mae: result.hybrid_metrics?.mae || 0,
        mrr: result.hybrid_metrics?.mrr || 0
      },
      all_recommendations: result.explanations.map(exp => ({
        title: exp.itemTitle,
        type: exp.itemType,
        relevance_score: exp.relevanceScore,
        reasons: exp.reasons.map(r => ({
          label: r.label,
          value: r.value,
          weight: r.weight
        }))
      })),
      top_recommendations: result.explanations.slice(0, 5).map(exp => ({
        title: exp.itemTitle,
        type: exp.itemType,
        relevance_score: exp.relevanceScore,
        reasons: exp.reasons.map(r => ({
          label: r.label,
          value: r.value,
          weight: r.weight
        }))
      }))
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'evaluation_results.json'),
      JSON.stringify(output, null, 2)
    );
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RECOMMENDATION EVALUATION RESULTS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    if (result.user) {
      console.log('👤 USER:', result.user.username);
      console.log('📌 INTERESTS:', result.user.interests.join(', '));
      console.log('📝 RECOMMENDATIONS:', result.recommendations.length, 'items\n');
      
      console.log('📊 ISO 25010 FUNCTIONAL SUITABILITY METRICS:');
      console.log('─────────────────────────────────────────');
      console.log('✓ Functional Completeness:', result.metrics.functional_completeness + '%');
      console.log('✓ Functional Correctness:', result.metrics.functional_correctness + '%');
      console.log('✓ Functional Appropriateness:', result.metrics.functional_appropriateness + '%');
      
      console.log('\n📈 HYBRID FILTERING EVALUATION METRICS:');
      console.log('─────────────────────────────────────────');
      console.log('✓ Cosine Similarity:', result.hybrid_metrics.cosine_similarity);
      console.log('✓ RMSE:', result.hybrid_metrics.rmse);
      console.log('✓ MAE:', result.hybrid_metrics.mae);
      console.log('✓ MRR:', result.hybrid_metrics.mrr);
      
      console.log('\n🎯 ALL 10 RECOMMENDATIONS:');
      console.log('─────────────────────────────────────────');
      result.explanations.forEach((exp, i) => {
        console.log(`\n${i+1}. ${exp.itemTitle}`);
        console.log(`   Type: ${exp.itemType}`);
        console.log(`   Relevance Score: ${exp.relevanceScore}`);
        if (exp.reasons.length > 0) {
          console.log('   Reasons:');
          exp.reasons.forEach(r => {
            console.log(`     - ${r.label}: ${r.value}`);
          });
        } else {
          console.log('   Reasons: No detailed reasons available');
        }
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('\n✓ Results saved to evaluation_results.json');
    
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    mongoose.connection.close();
  }
}

evaluate();
