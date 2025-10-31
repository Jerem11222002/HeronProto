const interestMap = {
  1: ['music', 'performance'],
  2: ['dance', 'workshop'],
  3: ['theatre', 'arts'],
  4: ['visual-arts', 'exhibition'],
  5: ['literature', 'writing'],
  6: ['film', 'media'],
  7: ['photography', 'visual'],
  8: ['crafts', 'workshop'],
  9: ['design', 'digital'],
  10: ['cultural', 'events']
};

const getTagsFromInterestIds = (interestIds) => {
  if (!Array.isArray(interestIds)) return [];
  
  return [...new Set(
    interestIds.reduce((tags, id) => {
      if (interestMap[id]) {
        tags.push(...interestMap[id]);
      }
      return tags;
    }, [])
  )];
};

const getInterestIdsFromTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  
  return [...new Set(
    Object.entries(interestMap)
      .filter(([_, tagList]) => 
        tags.some(tag => tagList.includes(tag)))
      .map(([id, _]) => Number(id))
  )];
};

module.exports = {
  interestMap,
  getTagsFromInterestIds,
  getInterestIdsFromTags
};