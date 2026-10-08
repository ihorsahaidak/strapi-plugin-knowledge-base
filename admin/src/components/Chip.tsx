import * as React from 'react';
import { Box, Typography } from '@strapi/design-system';

/**
 * A plain label chip. The design system's <Tag> insists on an icon and a
 * dismiss affordance, which is not what a tag list wants here.
 */
const Chip = ({ children, active = false }: { children: React.ReactNode; active?: boolean }) => (
  <Box
    paddingLeft={2}
    paddingRight={2}
    paddingTop={1}
    paddingBottom={1}
    hasRadius
    background={active ? 'primary100' : 'neutral150'}
  >
    <Typography variant="pi" textColor={active ? 'primary600' : 'neutral700'}>
      {children}
    </Typography>
  </Box>
);

export default Chip;
