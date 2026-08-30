package com.zgsf.srpm.repo;

import com.zgsf.srpm.domain.ProjectEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<ProjectEntity, Long> {}
